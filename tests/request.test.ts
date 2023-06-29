import { RequestGenerator, RequestType } from '../src/Request';

describe('The request object', () => {
	it('should generate the correct request string for the check request', () => {
		const requestType = RequestType.CHECK;
		const data = [
			'6bac8a660e8db4b32ab77c5fb8682744',
			'16d5818bec817cdab47ed68b07aa511c',
			'8c5d123198562f030ee15579e08e4224',
			'9917d1b8a373ac2ac6d92ced37558db2',
			'897dadeff0b5432633e7f4a8b568fe9f',
		];

		const requestObject = RequestGenerator.Generate(requestType, 'test', data);

		expect(requestObject).toHaveProperty('type', RequestType.CHECK);
		expect(requestObject).toHaveProperty('body');
		requestObject.body.forEach((requestString) => {
			expect(requestString).toMatch(/[a-z]{4}\?[a-zA-Z]+\?[\d]+\n|(([a-f0-9]{32}\n)+)/);
		});
	});
});
