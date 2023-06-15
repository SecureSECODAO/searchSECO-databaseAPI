import { RequestType } from './Request'

export class ResponseData {
    [key: string]: unknown
}
export class CheckResponseData extends ResponseData {
    public method_hash = ''
    public projectID = ''
    public startVersion = ''
    public startVersionHash = ''
    public endVersion = ''
    public endVersionHash = ''
    public method_name = ''
    public file = ''
    public lineNumber = ''
    public parserVersion = ''
    public vulnCode = ''
    public authorTotal = ''
    public authorIds: string[] = []
}
export class AuthorResponseData extends ResponseData {
    public username = ''
    public email = ''
    public uuid = ''
}
export class ProjectResponseData extends ResponseData {
    public id = ''
    public versionTime = ''
    public versionHash = ''
    public license = ''
    public name = ''
    public url = ''
    public authorName = ''
    public authorMail = ''
    public defaultBranch = ''
}

export class VersionResponseData extends ResponseData {
    raw = ''
}
export class JobResponseData extends ResponseData {
    raw = ''
}

export class TCPResponse {
    public responseCode: number
    public requestType: RequestType
    public response: unknown[]
    constructor(responseCode: number, requestType: RequestType, response: unknown[]) {
        this.responseCode = responseCode
        this.requestType = requestType
        this.response = response
    }
}


export class ResponseDecoder {
    private static readonly _instance = new ResponseDecoder()

    private getResponseType(type: RequestType): ResponseData {
        switch (type) {
            case RequestType.CHECK: return new CheckResponseData()
            case RequestType.GET_AUTHOR: return new AuthorResponseData()
            case RequestType.EXTRACT_PROJECTS: return new ProjectResponseData()
            case RequestType.GET_PREVIOUS_PROJECT: return new VersionResponseData()
            case RequestType.GET_TOP_JOB: return new JobResponseData()
            default: return new ResponseData()
        }
    }

    public static Decode(request: RequestType, raw: string[]): ResponseData[] {
        if (raw.includes('No results found.'))
            return []

        const response = ResponseDecoder._instance.getResponseType(request)
        if (typeof response == typeof VersionResponseData || typeof JobResponseData) {
            response.raw = raw.join('?')
            return [response]
        }

        const decoded: ResponseData[] = []
        raw.forEach(line => {
            const rawMetadata = line.split('?')
            const responseObj = JSON.parse(JSON.stringify(response)) as { [key:string]: unknown }
            const keys = Object.keys(responseObj)
            keys.forEach((key, idx) => {
                if (idx == keys.length - 1 && idx < rawMetadata.length - 1) {
                    for (let i = idx; i < rawMetadata.length; i++)
                        if (Array.isArray(responseObj[key])) 
                            (responseObj[key] as string[]).push(rawMetadata[i])
                }
                else if (Array.isArray(responseObj[key])) 
                    (responseObj[key] as string[]).push(rawMetadata[idx])
                else responseObj[key] = rawMetadata[idx] || ''
            })
            decoded.push(responseObj)
        })
        return decoded
     }
}
