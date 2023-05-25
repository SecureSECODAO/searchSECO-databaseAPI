import { Socket } from 'net'
import { AuthorResponseData, CheckResponseData, ResponseData, ResponseDecoder, TCPResponse } from './Response'
import { RequestType, TCPRequest, RequestGenerator } from './Request'


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
    Fetch(requestType: RequestType, data: string[]): Promise<TCPResponse>
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
    private _silent: boolean = false

    constructor(clientName: string, host: string, port: number | string) {
        this._clientName = clientName
        this._port = typeof(port) == 'number' ? port : parseInt(port)
        this._host = host

        this._client = new Socket()
        this._client.on('error', (err: any) => {
            this._error = err
        })
        this._client.on('data', (data: any) => {
            const [code, ...rawResponse] = data.toString().split('\n')
            const { type } = this._request || { type: RequestType.UNDEFINED }
            
            this._requestProcessed = true
            this._busy = false

            this._response = new TCPResponse(
                parseInt(code),
                type,
                ResponseDecoder.Decode(type, rawResponse.filter((r: string) => r !== ''))
            )
            if (!this._silent) console.log("Done!")
            this._client.destroy()
        })
    }

    public Silence(isSilent: boolean) {
        this._silent = isSilent
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

        const checkResponse = await this.Fetch(RequestType.CHECK, hashes)
        responses.push(checkResponse)

        const authors = Array.from(new Set(checkResponse.response.map((r: CheckResponseData) => r.authorIds).reduce((acc: string[], val: string[]) => acc.concat(val), [])))
        const authorResponse = await this.Fetch(RequestType.GET_AUTHOR, authors)
        responses.push(authorResponse)

        const uniqueVersions = new Set<string>() 
        checkResponse.response.forEach((r: CheckResponseData) => {
            uniqueVersions.add(`${r.projectID}?${r.startVersion}`)
            uniqueVersions.add(`${r.projectID}?${r.endVersion}`)
        })
        const versionResponse = await this.Fetch(RequestType.EXTRACT_PROJECTS, Array.from(uniqueVersions))
        responses.push(versionResponse)

        return responses
    }

    public async Fetch(type: RequestType, data: string[]): Promise<TCPResponse> {
        if (!this._silent) console.log(`Fetching ${data.length} items...`)

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
        this._client.write(request)
    }
}
