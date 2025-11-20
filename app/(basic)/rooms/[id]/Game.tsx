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

export default function Game({ roomCode, accessToken, user }: GameProps) {
    const router = useRouter()
    const audioMsgRef = useRef<HTMLAudioElement>(null)
    const audioMoveRef = useRef<HTMLAudioElement>(null)
    const audioWonRef = useRef<HTMLAudioElement>(null)
    const [board, setBoard] = useState<GameBoard>(new GameBoard())
    const [movingPiece, setMovingPiece] = useState<{
        piece: GamePiece
        coord: CoordinationType
    } | null>(null)
    const [status, setStatus] = useState<HubConnectionState>(
        HubConnectionState.Disconnected
    )
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
    const [messages, setMessages] = useState<MessageProps[]>([])

    // --- Only connect when user + accessToken are ready ---
    const { connection } = useSignalR(
        user && accessToken
            ? `http://192.168.1.42:5000/hubs/game?roomCode=${roomCode}`
            : '',
        {
            accessTokenFactory: () => accessToken,
            withCredentials: true,
        }
    )

    // --- Determine turn ---
    const isUserTurn =
        isPlayer &&
        (() => {
            if (board.isRedTurn) {
                return (isHost && board.isHostRed) || (!isHost && !board.isHostRed)
            } else {
                return (isHost && !board.isHostRed) || (!isHost && board.isHostRed)
            }
        })()

    const isBoardReversed: boolean = !(!isPlayer
        ? !board.isHostRed
        : (board.isHostRed && isHost) || (!board.isHostRed && !isHost))

    // --- Hub event handlers ---
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

        connection.on(SignalREventName.LoadBoard, (squares, isHostRed, isRedTurn) => {
            setBoard(new GameBoard({ squares, isHostRed, isRedTurn }))
        })

        connection.on(SignalREventName.Moved, (source, destination, isRedTurn) => {
            audioMoveRef.current?.play()
            setBoard((b) => b.move(source, destination, isRedTurn))
        })

        connection.on(SignalREventName.MoveFailed, () => {
            enqueueSnackbar('Di chuyển thất bại', { variant: 'error' })
        })

        connection.on(SignalREventName.Ended, (_isRed, winUser: UserDto) => {
            setMessages((a) => [
                ...a,
                { content: `${winUser.userName} thắng!`, ...systemMsgProps },
            ])
            audioWonRef.current?.play()
            enqueueSnackbar(`${winUser.userName} thắng!`, { variant: 'warning' })
        })

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

        return () => connection.off() // cleanup
    }, [connection])

    useEffect(() => {
        if (connection) setStatus(connection.state)
    }, [connection, connection?.state])

    // --- Drag & Drop handlers ---
    const handleDragCancel = useCallback(() => setMovingPiece(null), [])
    const handleDragStart = useCallback(
        ({ active }: DragStartEvent) => {
            const piece = board.squares.reduce<GamePiece | null>((acc, row) => {
                return acc ?? row.find((cell) => cell?.id === active.id) ?? null
            }, null)
            if (piece) setMovingPiece({ piece, coord: piece.coord })
        },
        [board.squares]
    )
    const handleDragEnd = useCallback(
        (event: DragEndEvent) => {
            if (!movingPiece?.coord || !movingPiece?.piece || !event.over?.id) return
            const [x, y] = event.over.id.toString().split('_').map(Number)
            const dest = { x, y }
            if (movingPiece.coord.x === dest.x && movingPiece.coord.y === dest.y) return
            if (!movingPiece.piece.isValidMove(dest, board)) {
                return enqueueSnackbar('Nước đi không hợp lệ!', { variant: 'error' })
            }
            setMovingPiece(null)
            connection?.send('Move', { source: movingPiece.coord, destination: dest })
        },
        [board, connection, movingPiece]
    )

    const handleStartPressed = useCallback(() => connection?.send('NewGame'), [connection])

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
                if (!isUserTurn)
                    return (
                        <Cell key={`cell_${i}_${j}`} id={`${i}_${j}`} x={i} y={j}>
                            <Piece id={cell.id} target={cell} position={cell.coord} disabled draggable={false} title="Không thể di chuyển" />
                        </Cell>
                    )
                if (board.isRedTurn === cell.isRed)
                    return (
                        <Cell key={`cell_${i}_${j}`} id={`${i}_${j}`} x={i} y={j}>
                            <DraggablePiece id={cell.id} target={cell} position={cell.coord} title="Có thể di chuyển" />
                        </Cell>
                    )
                return (
                    <Cell key={`cell_${i}_${j}`} id={`${i}_${j}`} x={i} y={j}>
                        <Piece id={cell.id} target={cell} position={cell.coord} disabled draggable={false} title="Không thể di chuyển" />
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
                    <div id="left-area" className="col-span-2 flex flex-col space-y-2 pb-2">
                        <MenuBox handleStartPressed={handleStartPressed} roomCode={roomCode} viewCount={room.countUser - 2 <= 0 ? 0 : room.countUser - 2} />
                        <ChatBox messages={messages} handleSend={(msg) => connection?.send('Chat', msg)} />
                    </div>
                    <Board><RenderedSquares /></Board>
                    <div id="right-area" className="col-span-2 flex flex-col space-y-2">
                        {isPlayer ? (
                            <>
                                <PlayerArea playerIndex={1} userName={!isHost ? room.hostUser?.userName : !isOpponent ? room.opponentUser?.userName : undefined} label={isUserTurn ? 'ĐANG CHỜ TỚI LƯỢT' : undefined} />
                                <PlayerArea playerIndex={2} userName={user.userName} label={!isUserTurn ? 'ĐANG CHỜ TỚI LƯỢT' : undefined} />
                            </>
                        ) : (
                            <>
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
