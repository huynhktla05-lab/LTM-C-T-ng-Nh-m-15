'use client'

import React from 'react'
import {
    HubConnectionBuilder,
    HttpTransportType,
    IHttpConnectionOptions,
    HubConnectionState,
} from '@microsoft/signalr'

function useSignalR(webSocketURI?: string, options?: IHttpConnectionOptions) {
    // Nếu không truyền URI, dùng biến môi trường
    const wsUrl = webSocketURI || `${process.env.NEXT_PUBLIC_WS_URL}/hubs/game`

    const connectionOptions: IHttpConnectionOptions = {
        skipNegotiation: true,
        transport: HttpTransportType.WebSockets,
        ...options,
    }

    const [connection, setConnection] = React.useState(() =>
        new HubConnectionBuilder()
            .withUrl(wsUrl, connectionOptions)
            .withAutomaticReconnect()
            .build()
    )

    React.useEffect(() => {
        if (connection.state === HubConnectionState.Disconnected) {
            connection.start().catch(err => console.error('SignalR start failed:', err))
        }

        return () => {
            if (connection.state !== HubConnectionState.Disconnected) {
                connection.stop().catch(err => console.error('SignalR stop failed:', err))
            }
        }
    }, [connection])

    return { connection, setConnection }
}

export default useSignalR

export enum SignalREventName {
    LoadBoard = 'LoadBoard',
    Moved = 'Moved',
    MoveFailed = 'MoveFailed',
    Ended = 'Ended',
    Chatted = 'Chatted',
    Joined = 'Joined',
    Left = 'Left',
    HostLeft = 'HostLeft',
    RoomDeleted = 'RoomDeleted',
    Connected = 'connected',
    Error = 'error',
}
