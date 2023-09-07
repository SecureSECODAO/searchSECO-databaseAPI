
import EventEmitter from 'events'
import { fork, ChildProcess } from 'child_process'
import { TCPRequest } from './Request';
import { TCPResponse } from './Response'
import path from 'path'

const enum Message {
    
    STOP = 'stp'
}

class Queue<T> {
	private _elements: { [key: number]: T } = {};
	private _head = 0;
	private _tail = 0;

	enqueue(element: T): void {
		this._elements[this._tail] = element;
		this._tail++;
	}

	dequeue(): T | undefined {
		const item = this._elements[this._head];
		delete this._elements[this._head];
		this._head++;
		return item;
	}

	peek(): T | undefined {
		return this._elements[this._head];
	}

	get length(): number {
		return Math.max(0, this._tail - this._head);
	}

	get isEmpty(): boolean {
		return this.length === 0;
	}
}


export class Thread {
    private _requests: Queue<TCPRequest>
    private _responses: Queue<TCPResponse>
    private _instance: ChildProcess
    private _eventEmitter: EventEmitter

    constructor(eventEmitter: EventEmitter) {
        this._requests = new Queue<TCPRequest>()
        this._responses = new Queue<TCPResponse>()
        this._eventEmitter = eventEmitter
    }

    public Initialize() {
        this._instance = fork(path.join(__dirname, '../thread'))
    }

    public AddRequest(req: TCPRequest) {
        this._requests.enqueue(req)

    }


}