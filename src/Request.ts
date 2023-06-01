

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
    UNDEFINED = 'undf'
}


export type TCPRequest = {
    type: RequestType,
    body: string[]
}

export class RequestGenerator {
    public static Generate(type: RequestType, clientName: string, raw: string[]): TCPRequest {
        const body = raw.join('\n')
        const header = [type, clientName, body.length == 0 ? 0 : body.length+1].join('?')

        return {
            type,
            body: [ `${header}\n`, body.length > 0 ? `${body}\n` : body ]
        }
    }
}
