'use client'

import LoadingBBQ from '@/components/ui/LoadingBBQ'
import useGetRoomById from '@/features/room/useGetRoomById'
import { User } from '@/features/user/user.types'
import GameBoard from '@/lib/game/Board'
import GamePiece from '@/lib/game/QuanCo/Piece'
import useSignalR, { SignalREventName } from '@/lib/hooks/useSignalR'
import {
    DndContext,
    DragEndEvent,
    DragOverlay,
    DragStartEvent,
} from '@dnd-kit/core'
import { HubConnectionState } from '@microsoft/signalr'
import { AxiosError } from 'axios'
import { useRouter } from 'next/navigation'
import { enqueueSnackbar } from 'notistack'
import { useCallback, useEffect, useRef, useState } from 'react'
import Board from './Board'
import Cell from './Cell'
import ChatBox from './LeftArea/ChatBox'
import { MessageProps } from './LeftArea/ChatBubble'
import MenuBox from './LeftArea/MenuBox'
import Piece, { DraggablePiece } from './Piece'
import PlayerArea from './RightArea/PlayerArea'
import WaitingContainer from './WaitingContainer'

type GameProps = {
    roomCode: string
    accessToken: string
    user: User
}

type UserDto = { id: string; userName: string; email: string }
const systemDisplayName = 'Thịt nướng'
const systemMsgProps = {
    displayName: systemDisplayName,
    system: true,
    badge: 'system',
}

// Hàm format thời gian (Giây -> HH:MM:SS)
const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
    const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
}

export default function Game({ roomCode, accessToken, user }: GameProps) {
    const router = useRouter()
    
    // --- Refs Audio ---
    const audioMsgRef = useRef<HTMLAudioElement>(null)
    const audioMoveRef = useRef<HTMLAudioElement>(null)
    const audioWonRef = useRef<HTMLAudioElement>(null)
    
    // --- Game States ---
    const [board, setBoard] = useState<GameBoard>(new GameBoard())
    const [movingPiece, setMovingPiece] = useState<{ piece: GamePiece; coord: CoordinationType } | null>(null)
    const [status, setStatus] = useState<HubConnectionState>(HubConnectionState.Disconnected)
    const [messages, setMessages] = useState<MessageProps[]>([])

    // --- NEW STATES: Timer & Game Status ---
    const [isGameStarted, setIsGameStarted] = useState(false);
    const [totalSeconds, setTotalSeconds] = useState(0); // Thời gian trôi qua
    const [turnSeconds, setTurnSeconds] = useState(60);  // Thời gian nước đi (60s)
    const [imReady, setImReady] = useState(false);       // Trạng thái nút Sẵn sàng

    const {
        data: room,
        isLoading,
        isError,
        error,
        refetch,
    } = useGetRoomById(roomCode)

    const isHost = user?.id === room?.hostUser?.id
    const isOpponent = user?.id === room?.opponentUser?.id
    const isPlayer = isHost || isOpponent

    // --- SignalR Connection ---
    const { connection } = useSignalR(
        user && accessToken
            ? `http://192.168.1.87:5000/hubs/game?roomCode=${roomCode}`
            : '',
        {
            accessTokenFactory: () => accessToken,
            withCredentials: true,
        }
    )

    // --- Xác định lượt đi ---
    const isUserTurn = isPlayer && (() => {
        if (board.isRedTurn) {
            return (isHost && board.isHostRed) || (!isHost && !board.isHostRed)
        } else {
            return (isHost && !board.isHostRed) || (!isHost && board.isHostRed)
        }
    })()

    // --- TIMER LOGIC (Chạy đồng hồ) ---
    useEffect(() => {
        let interval: NodeJS.Timeout;

        // CHỈ CHẠY KHI GAME ĐÃ ĐƯỢC KÍCH HOẠT (isGameStarted = true)
        if (isGameStarted) {
            interval = setInterval(() => {
                // Tăng thời gian tổng
                setTotalSeconds((prev) => prev + 1);

                // Giảm thời gian nước đi
                setTurnSeconds((prev) => {
                    if (prev <= 0) return 0; // Hết giờ thì đứng im
                    return prev - 1;
                });
            }, 1000);
        }

        return () => clearInterval(interval);
    }, [isGameStarted]);

    // --- SignalR Event Handlers ---
    useEffect(() => {
        if (!connection) return

        console.log('Connecting to SignalR Hub...')

        connection.on(SignalREventName.Connected, () => {
            console.log('✅ Connected to Hub')
            setStatus(HubConnectionState.Connected)
        })

        connection.on(SignalREventName.Error, (e) => {
            console.error('🚨 Hub error:', e)
        })

        // --- XỬ LÝ GAME BẮT ĐẦU (KÍCH HOẠT TIMER Ở ĐÂY) ---
        connection.on("OnGameStarted", () => {
            console.log("Game started by Server!");
            setIsGameStarted(true); // <--- Kích hoạt biến này để useEffect Timer chạy
            setTotalSeconds(0);
            setTurnSeconds(60);
            enqueueSnackbar('Trận đấu bắt đầu!', { variant: 'info' });
            setMessages((a) => [...a, { content: 'Trận đấu bắt đầu!', ...systemMsgProps }]);
        });

        connection.on(SignalREventName.LoadBoard, (squares, isHostRed, isRedTurn) => {
            setBoard(new GameBoard({ squares, isHostRed, isRedTurn }))
            
            // --- SỬA Ở ĐÂY: KHÔNG TỰ KÍCH HOẠT TIMER KHI LOAD BOARD ---
            // setIsGameStarted(true); // Đã comment dòng này để tránh timer chạy khi vừa vào phòng
        })

        connection.on(SignalREventName.Moved, (source, destination, isRedTurn) => {
            audioMoveRef.current?.play()
            setBoard((b) => b.move(source, destination, isRedTurn))
            
            // --- RESET TURN TIMER KHI CÓ NƯỚC ĐI MỚI ---
            setTurnSeconds(60); 
        })

        connection.on(SignalREventName.MoveFailed, () => {
            enqueueSnackbar('Di chuyển thất bại', { variant: 'error' })
        })

        // --- XỬ LÝ KẾT THÚC GAME ---
        connection.on(SignalREventName.Ended, (_isRed, winUser: UserDto) => {
            setIsGameStarted(false); // Dừng đồng hồ ngay lập tức
            setMessages((a) => [
                ...a,
                { content: `${winUser.userName} thắng!`, ...systemMsgProps },
            ])
            audioWonRef.current?.play()
            enqueueSnackbar(`${winUser.userName} thắng!`, { variant: 'warning' })
        })

        // --- XỬ LÝ CHAT ---
        connection.on(SignalREventName.Chatted, (message, _roomCode, userDto: UserDto) => {
            setMessages((a) => [
                ...a,
                {
                    content: message,
                    displayName: userDto.userName,
                    me: user ? user.id === userDto.id : false,
                    system: false,
                },
            ])
            if (userDto.id !== user?.id) audioMsgRef.current?.play()
        })

        // --- XỬ LÝ RA/VÀO PHÒNG ---
        connection.on(SignalREventName.Joined, (userDto: UserDto) => {
            setMessages((a) => [
                ...a,
                { content: `${userDto.userName} vừa tham gia phòng`, ...systemMsgProps },
            ])
            refetch()
        })

        connection.on(SignalREventName.Left, (userDto: UserDto) => {
            setMessages((a) => [
                ...a,
                { content: `${userDto.userName} đã rời phòng`, ...systemMsgProps },
            ])
            refetch()
        })

        // --- XỬ LÝ CẦU HÒA (Draw) ---
        connection.on("OnDrawRequested", () => {
            if (confirm("Đối thủ muốn cầu hòa. Bạn có đồng ý không?")) {
                connection.invoke("AnswerDraw", roomCode, true);
            } else {
                connection.invoke("AnswerDraw", roomCode, false);
            }
        });

        connection.on("OnDrawRefused", () => {
            enqueueSnackbar('Đối thủ không đồng ý hòa!', { variant: 'warning' });
        });

        connection.on(SignalREventName.HostLeft, (seconds: number) => {
            enqueueSnackbar(
                `Phòng sẽ bị xóa sau ${seconds} giây nếu chủ phòng không vào lại`,
                { variant: 'warning' }
            )
        })

        connection.on(SignalREventName.RoomDeleted, () => {
            enqueueSnackbar('Đã xóa phòng!', { variant: 'warning' })
            router.push('/rooms')
        })

        return () => connection.off()
    }, [connection])

    useEffect(() => {
        if (connection) setStatus(connection.state)
    }, [connection, connection?.state])


    // --- Drag & Drop Handlers ---
    const handleDragCancel = useCallback(() => setMovingPiece(null), [])
    const handleDragStart = useCallback(
        ({ active }: DragStartEvent) => {
            // Chỉ cho phép kéo nếu là lượt của mình và Game đã bắt đầu
            if (!isGameStarted && !isPlayer) return; 

            const piece = board.squares.reduce<GamePiece | null>((acc, row) => {
                return acc ?? row.find((cell) => cell?.id === active.id) ?? null
            }, null)
            if (piece) setMovingPiece({ piece, coord: piece.coord })
        },
        [board.squares, isGameStarted, isPlayer]
    )

    const handleDragEnd = useCallback(
        (event: DragEndEvent) => {
            if (!movingPiece?.coord || !movingPiece?.piece || !event.over?.id) return
            const [x, y] = event.over.id.toString().split('_').map(Number)
            const dest = { x, y }
            if (movingPiece.coord.x === dest.x && movingPiece.coord.y === dest.y) return
            
            // Kiểm tra lượt đi phía Client để UX mượt hơn
            if (!isUserTurn) {
                return enqueueSnackbar('Chưa đến lượt của bạn!', { variant: 'warning' });
            }

            // Kiểm tra game đã start chưa (đề phòng hack client)
            if (!isGameStarted) {
                return enqueueSnackbar('Trận đấu chưa bắt đầu!', { variant: 'warning' });
            }

            if (!movingPiece.piece.isValidMove(dest, board)) {
                return enqueueSnackbar('Nước đi không hợp lệ!', { variant: 'error' })
            }
            setMovingPiece(null)
            connection?.send('Move', { source: movingPiece.coord, destination: dest })
        },
        [board, connection, movingPiece, isUserTurn, isGameStarted]
    )

    // --- BUTTON HANDLERS ---
    
    // 1. Nút Bắt đầu / Sẵn sàng
    const handleReadyPressed = useCallback(() => {
        setImReady(true);
        // Gửi tín hiệu Ready lên Server
        connection?.send('PlayerReady', roomCode).catch(e => console.error(e)); 
    }, [connection, roomCode]);

    // 2. Nút Cầu hòa
    const handleDrawPressed = useCallback(() => {
        if(!isGameStarted) return;
        if(confirm("Bạn muốn cầu hòa?")) {
            connection?.send('RequestDraw', roomCode);
        }
    }, [connection, roomCode, isGameStarted]);

    // 3. Nút Rời phòng (Thua cuộc)
    const handleLeavePressed = useCallback(() => {
        if(confirm("Rời phòng bạn sẽ bị xử thua. Tiếp tục?")) {
            connection?.send('LeaveGame', roomCode); 
            router.push('/rooms');
        }
    }, [connection, roomCode, router]);


    // --- Render Conditions ---
    if (!user) return null
    if (isLoading) return <WaitingContainer><LoadingBBQ /><span>Đang tải thông tin phòng...</span></WaitingContainer>
    if (error && isError) return <WaitingContainer><span>{(error as AxiosError).message}</span></WaitingContainer>
    if (!room) return <WaitingContainer><span>Phòng không tồn tại...</span></WaitingContainer>
    if (status !== HubConnectionState.Connected)
        return <WaitingContainer><LoadingBBQ /><span>Đang kết nối đến phòng...</span></WaitingContainer>

    const RenderedSquares = () => {
        return board.squares.map((row, i) =>
            row.map((cell, j) => {
                if (!cell) return <Cell key={`cell_${i}_${j}`} id={`${i}_${j}`} x={i} y={j}></Cell>
                
                // Logic hiển thị quân cờ: Chỉ cho phép kéo nếu là lượt mình VÀ game đã Start
                const canDrag = isUserTurn && (board.isRedTurn === cell.isRed) && isGameStarted;

                if (!canDrag)
                    return (
                        <Cell key={`cell_${i}_${j}`} id={`${i}_${j}`} x={i} y={j}>
                            <Piece id={cell.id} target={cell} position={cell.coord} disabled draggable={false} title="Không thể di chuyển" />
                        </Cell>
                    )
                return (
                    <Cell key={`cell_${i}_${j}`} id={`${i}_${j}`} x={i} y={j}>
                        <DraggablePiece id={cell.id} target={cell} position={cell.coord} title="Có thể di chuyển" />
                    </Cell>
                )
            })
        ).reverse()
    }

    return (
        <DndContext onDragStart={handleDragStart} onDragCancel={handleDragCancel} onDragEnd={handleDragEnd}>
            <audio ref={audioMsgRef} src="/sfx/msg.mp3" />
            <audio ref={audioMoveRef} src="/sfx/piece-move.mp3" />
            <audio ref={audioWonRef} src="/sfx/won.mp3" />
            <div className="h-full flex flex-col space-y-2">
                <div className="grid grid-cols-8 gap-2 flex-1">
                    {/* LEFT AREA: MENU BOX + CHAT */}
                    <div id="left-area" className="col-span-2 flex flex-col space-y-2 pb-2">
                        <MenuBox 
                            handleStartPressed={handleReadyPressed} 
                            handleDrawPressed={handleDrawPressed}   
                            handleLeavePressed={handleLeavePressed} 
                            isReady={imReady}                       
                            isGameStarted={isGameStarted}           
                            totalTimeStr={formatTime(totalSeconds)} 
                            roomCode={roomCode} 
                            viewCount={room.countUser - 2 <= 0 ? 0 : room.countUser - 2} 
                        />
                        <ChatBox messages={messages} handleSend={(msg) => connection?.send('Chat', msg)} />
                    </div>

                    <Board><RenderedSquares /></Board>

                    {/* RIGHT AREA: PLAYER INFO & TURN TIMER */}
                    <div id="right-area" className="col-span-2 flex flex-col space-y-2">
                        {isPlayer ? (
                            <>
                                {/* Đối thủ */}
                                <PlayerArea 
                                    playerIndex={1} 
                                    userName={!isHost ? room.hostUser?.userName : !isOpponent ? room.opponentUser?.userName : undefined} 
                                    label={isUserTurn ? 'ĐANG CHỜ TỚI LƯỢT' : undefined} 
                                    turnTime={!isUserTurn && isGameStarted ? turnSeconds : undefined}
                                />
                                {/* Mình */}
                                <PlayerArea 
                                    playerIndex={2} 
                                    userName={user.userName} 
                                    label={!isUserTurn ? 'ĐANG CHỜ TỚI LƯỢT' : undefined}
                                    turnTime={isUserTurn && isGameStarted ? turnSeconds : undefined}
                                />
                            </>
                        ) : (
                            <>
                                {/* Chế độ Khán giả */}
                                <PlayerArea playerIndex={1} userName={room.hostUser?.userName} label={board.isRedTurn && board.isHostRed ? undefined : 'ĐANG CHỜ TỚI LƯỢT'} />
                                <PlayerArea playerIndex={2} userName={room.opponentUser?.userName} label={board.isRedTurn && !board.isHostRed ? undefined : 'ĐANG CHỜ TỚI LƯỢT'} />
                            </>
                        )}
                    </div>
                </div>
            </div>
            <DragOverlay dropAnimation={null}>{movingPiece && <Piece clone target={movingPiece.piece} id={movingPiece.piece.id} />}</DragOverlay>
        </DndContext>
    )
}
