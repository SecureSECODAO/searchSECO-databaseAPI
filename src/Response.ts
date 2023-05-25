import { RequestType } from './Request'

export class ResponseData {
    [key: string]: any
}
export class CheckResponseData extends ResponseData {
    public method_hash: string = ''
    public projectID: string = ''
    public startVersion: string = ''
    public startVersionHash: string = ''
    public endVersion: string = ''
    public endVersionHash: string = ''
    public method_name: string = ''
    public file: string = ''
    public lineNumber: string = ''
    public parserVersion: string = ''
    public vulnCode: string = ''
    public authorTotal: string = ''
    public authorIds: string[] = []
}
export class AuthorResponseData extends ResponseData {
    public username: string = ''
    public email: string = ''
    public uuid: string = ''
}
export class ProjectResponseData extends ResponseData {
    public id: string = ''
    public versionTime: string = ''
    public versionHash: string = ''
    public license: string = ''
    public name: string = ''
    public url: string = ''
    public authorName: string = ''
    public authorMail: string = ''
    public defaultBranch: string = ''
}

export class VersionResponseData extends ResponseData {
}

export class TCPResponse {
    public responseCode: number
    public requestType: RequestType
    public response: any[]
    constructor(responseCode: number, requestType: RequestType, response: any[]) {
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
            default: return new ResponseData()
        }
    }

    public static Decode(request: RequestType, raw: string[]): ResponseData[] {
        if (raw.includes('No results found.'))
            return []

        const response = ResponseDecoder._instance.getResponseType(request)

        if (typeof response == typeof VersionResponseData) {
            response.raw = raw.join('?')
        }

        const decoded: ResponseData[] = []
        raw.forEach(line => {
            const rawMetadata = line.split('?')
            const decodedMetadata = JSON.parse(JSON.stringify(response)) as any
            const keys = Object.keys(decodedMetadata)
            keys.forEach((key, idx) => {
                if (idx == keys.length - 1 && idx < rawMetadata.length - 1) {
                    for (let i = idx; i < rawMetadata.length; i++)
                        (decodedMetadata[key] as string[]).push(rawMetadata[i])
                }
                else if (typeof decodedMetadata[key] === 'object') decodedMetadata[key].push(rawMetadata[idx])
                else decodedMetadata[key] = rawMetadata[idx]
            })
            // methodMetadata.authorIds = methodMetadata.authorIds.split(',')
            decoded.push(decodedMetadata)
        })
        return decoded
     }
}
