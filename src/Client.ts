import { Socket } from 'net';
import { MethodResponseData, ResponseDecoder, TCPResponse } from './Response';
import { RequestType, TCPRequest, RequestGenerator } from './Request';
import Logger, { Verbosity } from './searchSECO-logger/src/Logger';
import EventEmitter from 'events'

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

export class TCPClient extends EventEmitter implements ITCPClient {
	private readonly _port: number = -1;
	private readonly _host: string = '';
	private readonly _clientName: string;
	private readonly _client: Socket;
	private _request: TCPRequest | undefined = undefined;
	private _retryCount = 0;

	constructor(clientName: string, host: string, port: number | string, verbosity: Verbosity = Verbosity.DEBUG) {
		super()

		Logger.SetModule('database-API');
		Logger.SetVerbosity(verbosity);

		this._clientName = clientName;

		this._port = typeof port == 'number' ? port : parseInt(port);
		this._host = host;

		this._port = typeof port == 'number' ? port : parseInt(port);
		this._host = host;

		this._client = new Socket();
		this.initialize()
	}

	private initialize() {
		this._client.on('error', (err) => {
			this.emit('error', err)
			this._client.destroy();
		});
		this._client.on('data', (data: string) => {
			const [code, ...rawResponse] = data.toString().split('\n');
			const { type } = this._request || { type: RequestType.UNDEFINED };

			if (Number.isNaN(parseInt(code))) {
				Logger.Error(data, Logger.GetCallerLocation());
				this.emit('error', data)
				return;
			}

			this._retryCount = 0;


			const response = new TCPResponse(
				parseInt(code),
				type,
				ResponseDecoder.Decode(
					type,
					rawResponse.filter((r: string) => r !== '')
				)
			);

			Logger.Debug(`Response code ${response.responseCode} received from database.`, Logger.GetCallerLocation());

			switch (response.responseCode) {
				case 200: {
					const isMessage = ((res: string | undefined) => {
						return res && !res.includes('?') && Number.isNaN(parseInt(res));
					})((response.response[0] as { raw: string } | undefined)?.raw);

					if (isMessage) Logger.Info((response.response[0] as { raw: string }).raw, Logger.GetCallerLocation());
					break;
				}
				case 400:
					Logger.Error(
						`Bad request: ${(response.response[0] as { raw: string } | undefined)?.raw || 'error 400'}`,
						Logger.GetCallerLocation()
					);
					break;
				case 500:
					Logger.Error(
						`Server error: ${(response.response[0] as { raw: string } | undefined)?.raw || 'error 500'}`,
						Logger.GetCallerLocation()
					);
					break;
				default:
					Logger.Error(
						`Unknown error: ${(response.response[0] as { raw: string }).raw}`,
						Logger.GetCallerLocation()
					);
			}

			this.emit('data', response)
			this._client.destroy();
		});
	}

	private connect(): void {
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
					.map((r: MethodResponseData) => r.authorIds)
					.flat()
					.filter((r) => /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/.test(r))
			)
		);
		const authorResponse = await this.Execute(RequestType.GET_AUTHOR, authors);
		responses.push(authorResponse);

		const uniqueVersions = new Set<string>();
		checkResponse.response.forEach((r: MethodResponseData) => {
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
		this.connect()
		const request = RequestGenerator.Generate(type, this._clientName, data);
		this.send(request)

		return new Promise((resolve, reject) => {
			this.on('error', async err => {
				if (this._retryCount >= MAX_RETRY_COUNT) {
					Logger.Error(`Connection timed out with error ${err}, skipping project`, Logger.GetCallerLocation());
					reject(err)
				}
				else {
					Logger.Error(`Database Error: ${err}. Retrying after 2 seconds...`, Logger.GetCallerLocation());
					this._retryCount++;
					await this.Execute(type, data);
				}
			})
			this.on('data', (response: TCPResponse) => {
				resolve(response)
			})
		})
	}

	private send({ header, body }: TCPRequest) {
		Logger.Debug(`Sending ${header.length} bytes to the database.`, Logger.GetCallerLocation());
		Logger.Debug(`Sending: ${header}`, Logger.GetCallerLocation());
		this._client.write(header);

		Logger.Debug(`Sending ${body.length} bytes to the database.`, Logger.GetCallerLocation());
		Logger.Debug(`Sending: ${body}`, Logger.GetCallerLocation());
		this._client.write(body);
	}
}
