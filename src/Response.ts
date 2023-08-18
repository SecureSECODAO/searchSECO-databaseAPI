import { RequestType } from './Request';

type IResponseConstructor = {
	new(): ResponseData
}

export class ResponseData {
	[key: string]: unknown;
}

export class MethodResponseData extends ResponseData {
	public method_hash = '';
	public projectID = '';
	public startVersion = '';
	public startVersionHash = '';
	public endVersion = '';
	public endVersionHash = '';
	public method_name = '';
	public file = '';
	public lineNumber = '';
	public parserVersion = '';
	public vulnCode = '';
	public license = ''
	public authorTotal = '';
	public authorIds: string[] = [];
}

export class AuthorResponseData extends ResponseData {
	public username = '';
	public email = '';
	public uuid = '';
}
export class ProjectResponseData extends ResponseData {
	public id = '';
	public versionTime = '';
	public versionHash = '';
	public license = '';
	public name = '';
	public url = '';
	public ownerId = ''
	public parserVersion = ''
}


function createGenericResponseObject(
	TCreator: IResponseConstructor, 
	entries: string[], 
	filter: (idx: number) => boolean = () => false): ResponseData {
		const data = new TCreator()
		Object.keys(data).forEach((key, idx) => {
			if (filter(idx)) return
			data[key] = entries[idx]
		})
		return data
}

function decodeMethodData(raw: string) {
	const rawEntries = raw.split('?');
	const methodData = createGenericResponseObject(MethodResponseData, rawEntries, idx => idx >= 13)
	methodData.authorIds = rawEntries.slice(13)
	return methodData
}

function decodeAuthorData(raw: string) {
	const rawEntries = raw.split('?');
	const authorData = createGenericResponseObject(AuthorResponseData, rawEntries)
	return authorData
}

function decodeProjectData(raw: string) {
	const rawEntries = raw.split('?');
	const projectData = createGenericResponseObject(ProjectResponseData, rawEntries)
	return projectData
}

function decodeGeneric(raw: string) {
	const genericResponse = new ResponseData()
	genericResponse.raw = raw
	return genericResponse
}

export class TCPResponse {
	public responseCode: number;
	public requestType: RequestType;
	public response: ResponseData[];
	constructor(responseCode: number, requestType: RequestType, response: ResponseData[]) {
		this.responseCode = responseCode;
		this.requestType = requestType;
		this.response = response;
	}
}

export class ResponseDecoder {
	private static getResponseDecoder(type: RequestType): (raw: string) => ResponseData {
		switch (type) {
			case RequestType.CHECK:
				return decodeMethodData;
			case RequestType.GET_AUTHOR:
				return decodeAuthorData
			case RequestType.EXTRACT_PROJECTS:
				return decodeProjectData
			case RequestType.GET_PREVIOUS_PROJECT:
				return decodeGeneric
			case RequestType.GET_TOP_JOB:
				return decodeGeneric
			default:
				return decodeGeneric
		}
	}

	public static Decode(request: RequestType, raw: string[]): ResponseData[] {
		if (raw.includes('No results found.')) return [];

		const decodeResponse = this.getResponseDecoder(request);

		const decoded: ResponseData[] = [];
		raw.forEach((line) => {
			if (!line)
				return
			const responseObj = decodeResponse(line)
			if (!Object.keys(responseObj).some((key: keyof typeof responseObj) => responseObj[key] == undefined))
				decoded.push(responseObj)
		});
		return decoded;
	}
}
