import { RequestType } from "../src/Request";
import { TCPClient } from "../src/Client";

describe("The client", () => {
    let client: TCPClient

    beforeAll(() => {
        client = new TCPClient("test", process.env.DB_HOST || "127.0.0.1", process.env.DB_PORT || 8003, )
        client.Silence(true)
    })

    it("should correctly execute the 'check' command", async () => {
        const expectedRequestTypes = [ RequestType.CHECK, RequestType.GET_AUTHOR, RequestType.EXTRACT_PROJECTS ]
        const response = await client.Check([
            "6bac8a660e8db4b32ab77c5fb8682744",
            "16d5818bec817cdab47ed68b07aa511c",
            "8c5d123198562f030ee15579e08e4224",
            "9917d1b8a373ac2ac6d92ced37558db2",
            "897dadeff0b5432633e7f4a8b568fe9f"
        ])

        response.forEach(res => {
            expect(res).toHaveProperty('responseCode', 200)
            expect(expectedRequestTypes).toContain(res.requestType)
            expectedRequestTypes.splice(expectedRequestTypes.findIndex(type => type == res.requestType), 1)
        })
    })
})