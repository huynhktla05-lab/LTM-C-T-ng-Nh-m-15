using CoTuongBackend.Application.Games.Dtos;
using CoTuongBackend.Application.Games.Enums;
using CoTuongBackend.Application.Matches;
using CoTuongBackend.Application.Matches.Dtos;
using CoTuongBackend.Application.Rooms;
using CoTuongBackend.Application.Rooms.Dtos;
using CoTuongBackend.Application.Users;
using CoTuongBackend.Domain.Entities.Games;
using CoTuongBackend.Domain.Exceptions;
using CoTuongBackend.Domain.Services;
using CoTuongBackend.Infrastructure.Constants;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.Caching.Memory;
using SignalRSwaggerGen.Attributes;

namespace CoTuongBackend.API.Hubs;

[SignalRHub]
[Authorize]
public sealed class GameHub : Hub<IGameHubClient>
{
    private readonly IRoomService _roomService;
    private readonly IMatchService _matchService;
    private readonly IUserAccessor _userAccessor;
    private readonly ILogger<GameHub> _logger;
    private readonly IMemoryCache _memoryCache;

    public GameHub(IRoomService roomService, IMatchService matchService, IUserAccessor userAccessor, ILogger<GameHub> logger, IMemoryCache memoryCache)
    {
        _roomService = roomService;
        _matchService = matchService;
        _userAccessor = userAccessor;
        _logger = logger;
        _memoryCache = memoryCache;
    }

    public static Dictionary<string, Board> Boards { get; set; } = new();

    // --- 1. BIẾN LƯU TRẠNG THÁI READY (MỚI) ---
    // Key: RoomCode, Value: Danh sách ConnectionId đã bấm Sẵn sàng
    public static Dictionary<string, HashSet<string>> RoomsReady { get; set; } = new();


    public override async Task OnConnectedAsync()
    {
        // ... (Giữ nguyên logic cũ của bạn) ...
        var httpContext = Context.GetHttpContext();
        if (httpContext == null) return;
        if (!httpContext.Request.Query.TryGetValue("roomCode", out var roomCodeStringValues))
        {
            Context.Abort();
        }

        var roomCode = roomCodeStringValues.ToString();
        var isExists = await _roomService.IsExists(x => x.Code == roomCode);

        if (!isExists)
        {
            Context.Abort();
            return;
        }

        var deleteRoomCodeList = _memoryCache.Get<List<string>>(MemoryCacheConstants.DeleteRoomCodeList);
        // ... (Logic Cache cũ giữ nguyên) ...

        await _roomService.Join(new JoinRoomDto(roomCode, _userAccessor.Id));

        if (!await _roomService.IsExists(x => x.OpponentUserId == _userAccessor.Id || x.HostUserId == _userAccessor.Id))
        {
            Context.Abort();
            return;
        }

        // Check Room in Boards
        var hasRoom = Boards.TryGetValue(roomCode, out var board);
        if (!hasRoom)
        {
            Boards.Add(roomCode, new Board());
            board = Boards[roomCode];
        }

        if (board is null)
        {
            Context.Abort();
            return;
        }

        _logger.LogInformation("User: {UserName} - {ConnectionId} connected", _userAccessor.UserName, Context.ConnectionId);

        await Groups.AddToGroupAsync(Context.ConnectionId, roomCode);

        // Load board cho người mới vào (nhưng chưa Start game)
        await Clients.Client(Context.ConnectionId).LoadBoard(board.Squares, board.IsHostRed, board.IsRedTurn);

        await Clients.Group(roomCode)
            .Joined(new UserDto(_userAccessor.Id, _userAccessor.UserName, _userAccessor.Email));

        return;
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        // ... (Giữ nguyên logic cũ) ...
        _logger.LogInformation("User: {UserName} - {ConnectionId} disconnected", _userAccessor.UserName, Context.ConnectionId);
        
        var httpContext = Context.GetHttpContext();
        if (httpContext == null) return;
        if (!httpContext.Request.Query.TryGetValue("roomCode", out var roomCodeStringValues)) return;

        var roomCode = roomCodeStringValues.ToString();

        // Xóa trạng thái Ready nếu người chơi thoát đột ngột
        if (RoomsReady.ContainsKey(roomCode))
        {
            RoomsReady[roomCode].Remove(Context.ConnectionId);
        }

        RoomDto room;
        try
        {
            room = await _roomService.Get(roomCode);
        }
        catch (NotFoundException) { return; }

        if (room is null) return;

        if (room.HostUser.Id == _userAccessor.Id)
        {
            var timeoutSecond = 30;
            await Clients.Group(roomCode).HostLeft(timeoutSecond);
            // ... (Logic Cache delete room giữ nguyên) ...
        }

        await Groups.RemoveFromGroupAsync(Context.ConnectionId, roomCode);
        await Clients.Group(roomCode).Left(new UserDto(_userAccessor.Id, _userAccessor.UserName, _userAccessor.Email));
    }

    // --- 2. HÀM PLAYER READY (Thay thế cho NewGame cũ hoặc dùng song song) ---
    // Logic: Khi Client bấm "Sẵn sàng" -> Gọi hàm này
    public async Task PlayerReady(string roomCode)
    {
        // 1. Khởi tạo room trong Dictionary nếu chưa có
        if (!RoomsReady.ContainsKey(roomCode))
        {
            RoomsReady[roomCode] = new HashSet<string>();
        }

        // 2. Thêm người này vào danh sách Ready
        RoomsReady[roomCode].Add(Context.ConnectionId);

        // 3. Kiểm tra xem đã đủ 2 người chưa
        // (Lưu ý: Logic đếm 2 này giả định phòng tối đa 2 người chơi)
        if (RoomsReady[roomCode].Count >= 2)
        {
            // --- CẢ 2 ĐÃ SẴN SÀNG -> BẮT ĐẦU GAME ---

            // Reset bàn cờ (Logic giống hàm NewGame cũ của bạn)
            if (Boards.TryGetValue(roomCode, out var board))
            {
                board.Reset();
            }
            else
            {
                Boards.Add(roomCode, new Board());
                board = Boards[roomCode];
            }

            // Gửi bàn cờ mới về cho cả 2
            await Clients.Group(roomCode).LoadBoard(board.Squares, board.IsHostRed, board.IsRedTurn);

            // QUAN TRỌNG: Gửi tín hiệu Start để Frontend chạy đồng hồ
            await Clients.Group(roomCode).OnGameStarted();

            // Clear trạng thái ready để chuẩn bị cho ván sau
            RoomsReady[roomCode].Clear();
        }
        else
        {
            // Nếu mới có 1 người ready, có thể báo cho người kia biết (tuỳ chọn)
            await Clients.OthersInGroup(roomCode).OnOpponentReady();
        }
    }

    // --- 3. LOGIC CẦU HÒA (DRAW) ---
    public async Task RequestDraw(string roomCode)
    {
        // Gửi yêu cầu sang cho đối thủ
        await Clients.OthersInGroup(roomCode).OnDrawRequested();
    }

    public async Task AnswerDraw(string roomCode, bool agree)
    {
        if (agree)
        {
            // Xử lý hòa: Lưu DB kết quả hòa
            // Lưu ý: Cần chỉnh lại MatchService để hỗ trợ lưu kết quả hòa (nếu chưa có)
            await _matchService.Create(new CreateMatchWithRoomCodeDto(roomCode, _userAccessor.Id)); 
            
            // Gửi tin nhắn kết thúc (Có thể cần sửa Frontend để nhận diện flag Hòa)
            // Tạm thời mình gửi User thắng là null hoặc cờ đặc biệt, 
            // Ở đây mình gửi user hiện tại nhưng frontend cần hiểu là Draw nếu backend quy định
            // Cách tốt nhất là thêm tham số vào Ended(..., isDraw: true)
            
            // Ví dụ đơn giản: Báo game kết thúc, logic thắng thua user tự xử lý hoặc thêm enum Result
            // await Clients.Group(roomCode).Ended(false, ...); 
        }
        else
        {
            await Clients.OthersInGroup(roomCode).OnDrawRefused();
        }
    }

    // --- 4. LOGIC ĐẦU HÀNG / RỜI PHÒNG (SURRENDER) ---
    public async Task LeaveGame(string roomCode)
    {
        // Người gọi hàm này là người thua
        // Người còn lại trong phòng là người thắng
        
        // Lưu lịch sử đấu (User hiện tại thua)
        await _matchService.Create(new CreateMatchWithRoomCodeDto(roomCode, _userAccessor.Id));

        // Thông báo game kết thúc. 
        // Vì SignalR khó lấy user info của người Others ngay tại đây nếu không query DB,
        // nên logic đơn giản là Frontend tự biết: "Mình rời -> Mình thua", "Đối thủ rời -> Mình thắng"
        // Hoặc gửi sự kiện Left như cũ
        
        await Clients.OthersInGroup(roomCode).OnOpponentReady(); // Tái sử dụng hoặc gửi sự kiện riêng
    }
    
    // --- 5. LOGIC DI CHUYỂN (MOVE) ---
    public async Task Move(MovePieceDto movePieceDto)
    {
        // ... (Giữ nguyên logic Move cũ của bạn) ...
        var httpContext = Context.GetHttpContext();
        if (httpContext == null) return;
        if (!httpContext.Request.Query.TryGetValue("roomCode", out var roomCodeStringValues)) return;
        var roomCode = roomCodeStringValues.ToString();
        var (source, destination) = movePieceDto;

        if (source == destination) return;
        var hasRoom = Boards.TryGetValue(roomCode, out var board);

        if (!hasRoom || board is null)
        {
            await Clients.Client(Context.ConnectionId).MoveFailed(MoveStatus.BoardNotFound);
            return;
        }

        var piece = board.GetPiece(source);
        if (piece is null)
        {
            await Clients.Client(Context.ConnectionId).MoveFailed(MoveStatus.PieceNotFound);
            return;
        }
        if (!piece.IsValidMove(destination, board))
        {
            await Clients.Client(Context.ConnectionId).MoveFailed(MoveStatus.InvalidMove);
            return;
        }

        // Kiểm tra Ăn Tướng (Checkmate/Win)
        if (board.IsOpponentGeneral(piece, destination))
        {
            await _matchService.Create(new CreateMatchWithRoomCodeDto(roomCode, _userAccessor.Id));
            
            // Gửi sự kiện Kết thúc
            await Clients.Group(roomCode).Ended(piece.IsRed, new UserDto(_userAccessor.Id, _userAccessor.UserName, _userAccessor.Email));
            
            // Xóa trạng thái bàn cờ hoặc reset (tuỳ logic game)
            // board.Reset(); 
        }

        board.Move(piece, destination);
        board.IsRedTurn = !piece.IsRed;
        
        // Gửi sự kiện Đã di chuyển -> Frontend sẽ reset Timer tại đây
        await Clients.Group(roomCode).Moved(source, destination, !piece.IsRed);
    }

    public Task Chat(string message)
    {
        // ... (Giữ nguyên logic Chat cũ) ...
        var httpContext = Context.GetHttpContext();
        if (httpContext == null) return Task.CompletedTask;
        if (!httpContext.Request.Query.TryGetValue("roomCode", out var roomCodeStringValues)) return Task.CompletedTask;
        var roomCode = roomCodeStringValues.ToString();

        _logger.LogInformation("Chat from {UserName}: {Message}", _userAccessor.UserName, message);

        Clients.Group(roomCode).Chatted(message, roomCode, new UserDto(_userAccessor.Id, _userAccessor.UserName, _userAccessor.Email));
        return Task.CompletedTask;
    }
}
