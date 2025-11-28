import PlayerInformation from '@/components/player/PlayerInformation'
import React from 'react'

export type PlayerAreaProps = {
    playerIndex: number
    userName?: string
    avatarSrc?: string
    flagSrc?: string
    label?: string
    turnTime?: number // Nhận thời gian đếm ngược từ Game.tsx
}

// Hàm format giây thành MM:SS (Ví dụ: 65 -> 01:05)
const formatTurnTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
}

function PlayerArea({
    playerIndex,
    userName,
    avatarSrc,
    flagSrc,
    label,
    turnTime,
}: PlayerAreaProps) {

    // Logic xác định có phải lượt của người này không
    // Game.tsx truyền undefined nếu không phải lượt -> isMyTurn = false
    const isMyTurn = turnTime !== undefined;
    
    // Nếu thời gian còn ít hơn 10s thì hiện màu đỏ cảnh báo
    // (turnTime ?? 0) để tránh lỗi TypeScript báo "Object is possibly undefined"
    const isUrgent = isMyTurn && (turnTime ?? 0) <= 10;

    return (
        <div className="bg-primary w-full h-full rounded-md shadow-lg p-2 flex flex-col items-center overflow-y-auto">
            <div id={`player${playerIndex}`} className="self-start pl-4 py-2">
                <PlayerInformation
                    username={userName ?? `Trống`}
                    avatarSrc={avatarSrc ?? '/assets/avatars/avatar1.png'}
                    avatarSize={50}
                    imageWidth={70}
                    imageHeight={70}
                    hasFlag
                    flagSrc={flagSrc ?? '/assets/flags/VN.svg'}
                    hasScore
                    scoreValue={0}
                />
            </div>

            <div className="w-full h-[1px] border-1 bg-bamboo-100 solid"></div>

            <div
                id={`player${playerIndex}-captured-pieces`}
                className="h-full"
            ></div>

            <div
                id={`countdown_steps_player${playerIndex}`}
                className={`card rounded-md w-52 shadow-lg transition-all duration-300 ${
                    // Thêm hiệu ứng viền đỏ hoặc nền đỏ nhạt khi gấp gáp (tuỳ chọn)
                    isUrgent ? 'bg-red-100 border-red-500 border' : 'bg-bamboo-300'
                }`}
            >
                <div className="p-4">
                    <p 
                        className={`text-center text-xl transition-colors duration-300 ${
                            isUrgent 
                            ? 'text-red-600 font-bold animate-pulse' // Dưới 10s: Đỏ đậm + Nhấp nháy
                            : 'text-bamboo-100'                      // Bình thường: Màu tre
                        }`}
                    >
                        {isMyTurn 
                            ? `CÒN LẠI - ${formatTurnTime(turnTime ?? 0)}` 
                            : (label ?? '...')
                        }
                    </p>
                </div>
            </div>
        </div>
    )
}

export default PlayerArea
