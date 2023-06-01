import { Socket } from 'net'
import { AuthorResponseData, CheckResponseData, ResponseData, ResponseDecoder, TCPResponse } from './Response'
import { RequestType, TCPRequest, RequestGenerator } from './Request'
import Logger, { Verbosity } from './searchSECO-logger/src/Logger'


/**
 * The TCP Client interface
 */
export interface ITCPClient {
    /**
     * Fetches a response from the database API. 
     * @param requestType The request type to fetch
     * @param data The data to be used when processing the request
     * @returns A promise which resolves to a `TCPResponse` when the request is handled.
     */
    Execute(requestType: RequestType, data: string[]): Promise<TCPResponse>
}

export class TCPClient implements ITCPClient {
    private readonly _port: number = -1
    private readonly _host: string = ''
    private readonly _clientName: string
    private readonly _client: Socket
    private _request: TCPRequest | undefined = undefined
    private _requestProcessed: boolean = false
    private _busy: boolean = false
    private _response: TCPResponse | undefined = undefined
    private _error: any | undefined = undefined

    constructor(clientName: string, host: string, port: number | string, verbosity: Verbosity = Verbosity.DEBUG) {

        Logger.SetModule("database-API")
        Logger.SetVerbosity(verbosity)

        this._clientName = clientName

        this._port = typeof(port) == 'number' ? port : parseInt(port)
        this._host = host

        this._client = new Socket()
        this._client.on('error', (err: any) => {
            this._error = err
            this._requestProcessed = true
        })
        this._client.on('data', (data: any) => {

            Logger.Debug(`Received: ${data}`, Logger.GetCallerLocation())

            const [code, ...rawResponse] = data.toString().split('\n')

            if (Number.isNaN(parseInt(code))) {
                Logger.Error(data, Logger.GetCallerLocation())
                return
            }

            const { type } = this._request || { type: RequestType.UNDEFINED }

            this._requestProcessed = true
            this._busy = false

            this._response = new TCPResponse(
                parseInt(code),
                type,
                ResponseDecoder.Decode(type, rawResponse.filter((r: string) => r !== ''))
            )
            
            Logger.Debug(`Response code ${this._response.responseCode} received from database.`, Logger.GetCallerLocation())
            
            switch (this._response.responseCode) {
                case 200:
                    const isMessage = 
                        this._response.response[0] 
                        && this._response.response[0].raw 
                        && !this._response.response[0].raw.includes('?')
                    if (isMessage)
                        Logger.Info(this._response.response[0].raw, Logger.GetCallerLocation())
                    break
                case 400:
                    Logger.Error(`Bad request: ${this._response.response[0].raw}`, Logger.GetCallerLocation())
                    break
                case 500:
                    Logger.Error(`Server error: ${this._response.response[0].raw}`, Logger.GetCallerLocation())
                    break
            }

            this._client.destroy()
        })
    }

    private _connect(): void {
        this._client.connect(this._port, this._host)
    }

    /**
     * This is a basic implementation of the "Check" command that is normally issued by the controller.
     * In the future this function will become more generic.
     * @param data The hashes to check against the database
     */
    public async Check(hashes: string[]): Promise<TCPResponse[]> {
        const responses: TCPResponse[] = []

        const checkResponse = await this.Execute(RequestType.CHECK, hashes)
        responses.push(checkResponse)

        const authors = Array.from(new Set(checkResponse.response.map((r: CheckResponseData) => r.authorIds).reduce((acc: string[], val: string[]) => acc.concat(val), [])))
        const authorResponse = await this.Execute(RequestType.GET_AUTHOR, authors)
        responses.push(authorResponse)

        const uniqueVersions = new Set<string>() 
        checkResponse.response.forEach((r: CheckResponseData) => {
            uniqueVersions.add(`${r.projectID}?${r.startVersion}`)
            uniqueVersions.add(`${r.projectID}?${r.endVersion}`)
        })
        const versionResponse = await this.Execute(RequestType.EXTRACT_PROJECTS, Array.from(uniqueVersions))
        responses.push(versionResponse)

        return responses
    }

    public async Execute(type: RequestType, data: string[]): Promise<TCPResponse> {
        while (this._busy)
            await new Promise(resolve => setTimeout(resolve, 500))

        this._busy = true
        this._connect()

        this._requestProcessed = false
        
        this._request = RequestGenerator.Generate(type, this._clientName, data)

        this._request.body.forEach(r => this._sendData(r))

        while (!this._requestProcessed) {
            await new Promise(resolve => setTimeout(resolve, 500))
        }
        if (this._error)
            throw this._error
        return this._response || new TCPResponse(500, RequestType.UNDEFINED, [])
    }

    private _sendData(request: string) {
        Logger.Debug(`Sending ${request.length} bytes to the database.`, Logger.GetCallerLocation())
        Logger.Debug(`Sending: ${request}`, Logger.GetCallerLocation())
        this._client.write(request)
    }
}
