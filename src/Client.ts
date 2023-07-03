import { Socket } from 'net';
import { CheckResponseData, ResponseDecoder, TCPResponse } from './Response';
import { RequestType, TCPRequest, RequestGenerator } from './Request';
import Logger, { Verbosity } from './searchSECO-logger/src/Logger';

const MAX_RETRY_COUNT = 3;

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
	Execute(requestType: RequestType, data: string[]): Promise<TCPResponse>;
}

export class TCPClient implements ITCPClient {
	private readonly _port: number = -1;
	private readonly _host: string = '';
	private readonly _clientName: string;
	private readonly _client: Socket;
	private _request: TCPRequest | undefined = undefined;
	private _requestProcessed = false;
	private _busy = false;
	private _response: TCPResponse | undefined = undefined;
	private _error: unknown | undefined = undefined;
	private _retryCount = 0;

	constructor(clientName: string, host: string, port: number | string, verbosity: Verbosity = Verbosity.DEBUG) {
		Logger.SetModule('database-API');
		Logger.SetVerbosity(verbosity);

		this._clientName = clientName;

		this._port = typeof port == 'number' ? port : parseInt(port);
		this._host = host;

        this._port = typeof(port) == 'number' ? port : parseInt(port)
        this._host = host

        this._client = new Socket()
        this._client.on('error', (err: unknown) => {
            this._error = err
            this._requestProcessed = true
            this._busy = false
            this._client.destroy()
        })
        this._client.on('data', (data: string) => {

            const [code, ...rawResponse] = data.toString().split('\n')
            const { type } = this._request || { type: RequestType.UNDEFINED }

			if (Number.isNaN(parseInt(code))) {
				Logger.Error(data, Logger.GetCallerLocation());
				this._requestProcessed = true;
				this._busy = false;
				this._response = new TCPResponse(500, type, [code]);
				return;
			}

            this._retryCount = 0
            this._requestProcessed = true
            this._busy = false

			this._response = new TCPResponse(
				parseInt(code),
				type,
				ResponseDecoder.Decode(
					type,
					rawResponse.filter((r: string) => r !== '')
				)
			);

			Logger.Debug(`Response code ${this._response.responseCode} received from database.`, Logger.GetCallerLocation());

			switch (this._response.responseCode) {
				case 200: {
					const isMessage = ((res: string | undefined) => {
						return res && !res.includes('?') && Number.isNaN(parseInt(res));
					})((this._response.response[0] as { raw: string } | undefined)?.raw);

					if (isMessage) Logger.Info((this._response.response[0] as { raw: string }).raw, Logger.GetCallerLocation());
					break;
				}
				case 400:
					Logger.Error(
						`Bad request: ${(this._response.response[0] as { raw: string }).raw}`,
						Logger.GetCallerLocation()
					);
					break;
				case 500:
					Logger.Error(
						`Server error: ${(this._response.response[0] as { raw: string }).raw}`,
						Logger.GetCallerLocation()
					);
					break;
				default:
					Logger.Error(
						`Unknown error code: ${(this._response.response[0] as { raw: string }).raw}`,
						Logger.GetCallerLocation()
					);
			}

			this._client.destroy();
		});
	}

	private _connect(): void {
		this._client.connect(this._port, this._host);
	}

	/**
	 * This is a basic implementation of the "Check" command that is normally issued by the controller.
	 * In the future this function will become more generic.
	 * @param data The hashes to check against the database
	 */
	public async Check(hashes: string[]): Promise<TCPResponse[]> {
		const responses: TCPResponse[] = [];

		const checkResponse = await this.Execute(RequestType.CHECK, hashes);
		responses.push(checkResponse);

		const authors = Array.from(
			new Set(
				checkResponse.response
					.map((r: CheckResponseData) => r.authorIds)
					.flat()
					.filter((r) => /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/.test(r))
			)
		);
		const authorResponse = await this.Execute(RequestType.GET_AUTHOR, authors);
		responses.push(authorResponse);

		const uniqueVersions = new Set<string>();
		checkResponse.response.forEach((r: CheckResponseData) => {
			uniqueVersions.add(`${r.projectID}?${r.startVersion}`);
			uniqueVersions.add(`${r.projectID}?${r.endVersion}`);
		});
		const versionResponse = await this.Execute(
			RequestType.EXTRACT_PROJECTS,
			Array.from(uniqueVersions).filter((uniqueVersions) => uniqueVersions)
		);
		responses.push(versionResponse);

		return responses;
	}

	/**
	 * Executes a request against the SearchSECO database
	 * @param type The request type to execute
	 * @param data The data needed to be sent
	 * @returns A promise which resolves to a TCPResponse object.
	 */
	public async Execute(type: RequestType, data: string[]): Promise<TCPResponse> {
		while (this._busy) await new Promise((resolve) => setTimeout(resolve, 500));

		this._busy = true;
		this._connect();

		this._requestProcessed = false;

		this._request = RequestGenerator.Generate(type, this._clientName, data);

		this._sendData(this._request);

		while (!this._requestProcessed) await new Promise((resolve) => setTimeout(resolve, 500));

		if (this._error) {
			if (this._retryCount >= MAX_RETRY_COUNT) {
				Logger.Error(`Connection timed out with error ${this._error}, skipping project`, Logger.GetCallerLocation());
				this._retryCount = 0;
				this._error = undefined;
				return new TCPResponse(500, type, []);
			}

			Logger.Error(`Database Error: ${this._error}. Retrying after 2 seconds...`, Logger.GetCallerLocation());
			this._error = undefined;
			this._retryCount++;
			await new Promise((resolve) => setTimeout(resolve, 2000));
			await this.Execute(type, data);
		}
		return this._response || new TCPResponse(500, type, []);
	}

	private _sendData({ header, body }: TCPRequest) {
		Logger.Debug(`Sending ${header.length} bytes to the database.`, Logger.GetCallerLocation());
		Logger.Debug(`Sending: ${header}`, Logger.GetCallerLocation());
		this._client.write(header);

		Logger.Debug(`Sending ${body.length} bytes to the database.`, Logger.GetCallerLocation());
		Logger.Debug(`Sending: ${body}`, Logger.GetCallerLocation());
		this._client.write(body);
	}
}
