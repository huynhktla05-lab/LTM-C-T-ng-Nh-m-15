import React from 'react'
import MenuBoxTitle, { MenuBoxTitleProps } from './MenuBoxTitle'
// import Link from 'next/link' // Không dùng Link nữa vì cần xử lý logic trước khi rời

export type MenuBoxProps = {
    handleStartPressed: () => void
    handleDrawPressed: () => void   // Mới
    handleLeavePressed: () => void  // Mới
    isReady: boolean                // Mới: Trạng thái đã bấm sẵn sàng chưa
    isGameStarted: boolean          // Mới: Trạng thái game đang chạy chưa
    totalTimeStr: string            // Mới: Chuỗi thời gian "00:00:00"
} & MenuBoxTitleProps

function MenuBox({ 
    roomCode, 
    viewCount, 
    handleStartPressed,
    handleDrawPressed,
    handleLeavePressed,
    isReady,
    isGameStarted,
    totalTimeStr 
}: MenuBoxProps) {
    return (
        <div
            id="menu"
            className="h-full bg-primary w-full rounded-md shadow-lg p-2 flex flex-col items-center overflow-y-auto"
        >
            {/* Hard Code */}
            <MenuBoxTitle roomCode={roomCode} viewCount={viewCount} />

            <div className="w-full h-[1px] border-1 bg-bamboo-100 solid"></div>

            {/* Hiển thị thời gian thực từ Game.tsx */}
            <div className="text-center text-md md:text-4xl text-bamboo-100 my-4 font-mono">
                {totalTimeStr || "00:00:00"} trôi qua
            </div>

            <div className="flex flex-col space-y-2 items-center xl:space-y-0 xl:flex-row xl:space-x-2 my-1">
                <button 
                    className="btn btn-secondary btn-md w-48 text-lg disabled:opacity-50"
                    disabled={!isGameStarted} // Chỉ cho phép tạm dừng khi game đã chạy (nếu có logic)
                >
                    Tạm Dừng
                </button>
                <button 
                    className="btn btn-secondary btn-md w-48 text-lg disabled:opacity-50"
                    onClick={handleDrawPressed}
                    disabled={!isGameStarted} // Chỉ cầu hòa khi game đang chạy
                >
                    Cầu Hoà
                </button>
            </div>

            <div className="flex flex-col space-y-2 items-center xl:space-y-0 xl:flex-row xl:space-x-2 my-1">
                {/* Đổi từ Link sang Button để xử lý logic Rời phòng (xử thua) */}
                <button
                    className="btn btn-secondary btn-md w-48 text-lg hover:bg-red-600 hover:text-white transition-colors"
                    onClick={handleLeavePressed}
                >
                    Rời Phòng
                </button>
                
                <button
                    className={`btn btn-md w-48 text-lg transition-all ${
                        isReady || isGameStarted 
                        ? 'btn-disabled bg-gray-500 text-gray-300' 
                        : 'btn-secondary'
                    }`}
                    onClick={handleStartPressed}
                    disabled={isReady || isGameStarted}
                >
                    {isGameStarted 
                        ? 'Đang Chơi' 
                        : (isReady ? 'Đã Sẵn Sàng' : 'Sẵn Sàng')
                    }
                </button>
            </div>
        </div>
    )
}

export default MenuBox
