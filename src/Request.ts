export enum RequestType {
	UPLOAD = 'upld',
	CHECK = 'chck',
	CHECK_UPLOAD = 'chup',
	CONNECT = 'conn',
	GET_IPS = 'gtip',
	UPLOAD_JOB = 'upjb',
	UPLOAD_CRAWL_DATA = 'upcd',
	GET_TOP_JOB = 'gtjb',
	UPDATE_JOB = 'udjb',
	FINISH_JOB = 'fnjb',
	EXTRACT_PROJECTS = 'extp',
	GET_AUTHOR = 'idau',
	GET_METHOD_BY_NAME = 'aume',
	GET_PREVIOUS_PROJECT = 'gppr',
	UNDEFINED = 'undf',
}

export type TCPRequest = {
	type: RequestType;
	header: string;
	body: string;
};

export class RequestGenerator {
	public static Generate(type: RequestType, clientName: string, raw: string[]): TCPRequest {
		let body = raw.map((r) => Buffer.from(r).toString()).join('\n');
		if (body) body = `${body}\n`;

		const bodyLength = new Blob([body]).size;
		const header = `${[type, clientName, bodyLength].join('?')}\n`;

		return {
			type,
			header,
			body,
		};
	}
}
