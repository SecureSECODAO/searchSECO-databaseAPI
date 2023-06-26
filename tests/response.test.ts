import { Verbosity } from "../src/searchSECO-logger/src/Logger";
import { TCPClient } from "../src/Client"
import { RequestType } from "../src/Request"
import { ResponseDecoder, ResponseData } from "../src/Response"

describe("The response object", () => {
    let client;

    beforeAll(() => {
        client = new TCPClient("test", '131.211.31.209', 8003, Verbosity.SILENT)
    })

    it("should correctly decode a request object", () => {
        const raw = [
            '897dadeff0b5432633e7f4a8b568fe9f?1790983771?1527797086000?a80ee0d831a8ee69f1fad5b4673491847975eb26?1527797086000?a80ee0d831a8ee69f1fad5b4673491847975eb26?isOdd?index.js?12?1??2?0af1d147-b483-76a7-9e14-7f6828b94a60?66163fed-c2bd-940d-b4a6-ec6e153a90c4',
            '9917d1b8a373ac2ac6d92ced37558db2?1790983771?1527703251000?75e749a7926a3ae2dfd5b2eaab6d15956f73381a?1527797086000?a80ee0d831a8ee69f1fad5b4673491847975eb26??test.js?7?1??3?0af1d147-b483-76a7-9e14-7f6828b94a60?66163fed-c2bd-940d-b4a6-ec6e153a90c4?a6ad6bc8-a201-ff89-c5d3-0ea9c00a16d0',
            '8c5d123198562f030ee15579e08e4224?1790983771?1527703251000?75e749a7926a3ae2dfd5b2eaab6d15956f73381a?1527797086000?a80ee0d831a8ee69f1fad5b4673491847975eb26??test.js?28?1??1?0af1d147-b483-76a7-9e14-7f6828b94a60',
            '16d5818bec817cdab47ed68b07aa511c?1790983771?1527703251000?75e749a7926a3ae2dfd5b2eaab6d15956f73381a?1527797086000?a80ee0d831a8ee69f1fad5b4673491847975eb26??test.js?19?1??1?0af1d147-b483-76a7-9e14-7f6828b94a60',
            '6bac8a660e8db4b32ab77c5fb8682744?1790983771?1527703251000?75e749a7926a3ae2dfd5b2eaab6d15956f73381a?1527797086000?a80ee0d831a8ee69f1fad5b4673491847975eb26??test.js?8?1??1?0af1d147-b483-76a7-9e14-7f6828b94a60'
        ]

        const decoded = ResponseDecoder.Decode(RequestType.CHECK, raw)
        decoded.forEach(res => {
            expect(res).toBe<ResponseData>(res)
        })
    })
})