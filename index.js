/*
Copyright (c) 2016, William Viker <william.viker@gmail.com>

Permission to use, copy, modify, and/or distribute this software for any purpose with or without fee is hereby granted, provided that the above copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
*/

var debug        = require("debug")("tsl-umd");
var util         = require('util');
var EventEmitter = require('events').EventEmitter;
var dgram        = require('dgram');
var packet       = require('packet');

class TSL3 extends EventEmitter {

	listenUDP(port) {

		var self = this;
	
		self.port = port;
		self.parser = packet.createParser();
		self.server = dgram.createSocket('udp4');
		self.parser.packet('tsl', 'b8{x1, b7 => address},b8{x2, b2 => brightness, b1 => tally4, b1 => tally3, b1 => tally2, b1 => tally1 }, b8[16] => label');
	
		self.server.on('error', (err) => {
			debug('error',err);
			throw err;
			self.server.close();
		});
	
		self.server.on('message', (msg, rinfo) => {
			this.processTally(msg,rinfo);
		});
	
		self.server.on('listening', () => {
			var address = self.server.address();
			console.log(`server listening ${address.address}:${address.port}`);
		});
	
		self.server.bind(self.port);

		return self;
	
	}

	processTally(msg, rinfo) {
		var self = this;

		self.parser.extract("tsl", function (res) {
			res.label = new Buffer(res.label).toString();
			res.sender = rinfo.address;
			self.emit('message', res);
		});
		self.parser.parse(msg);
	}
}

class TSL5 extends EventEmitter {
    constructor () {
        super()
        //Message Format
        this._PBC     = 0 //offset
        this._VER     = 2
        this._FLAGS   = 3
        this._SCREEN  = 4
        this._INDEX   = 6
        this._CONTROL = 8
        this._LENGTH  = 10
    }

    listenUDP(port) {
        this.server = dgram.createSocket('udp4')
        this.server.bind(port)

        this.server.on('message',(msg, rinfo) => {
            this.processTally(msg,rinfo)
            debug('Message recieved: ', msg)
        })

        this.server.on('listening', () => {
            var address = this.server.address();
            debug(`server listening ${address.address}:${address.port}`);
        });

        this.server.on('error', (err) => {
            debug('server error: ', err);
            throw err;
        });

		return this;
    }

    processTally(data,rinfo) {
        let buf = Buffer.from(data)
        let tally = { display: {} }

        tally.sender  = rinfo.address
        tally.pbc     = buf.readInt16LE(this._PBC)
        tally.ver     = buf.readInt8(this._VER)
        tally.flags   = buf.readInt8(this._VER)
        tally.screen  = buf.readInt16LE(this._SCREEN)
        tally.index   = buf.readInt16LE(this._INDEX)
        tally.control = buf.readInt16LE(this._CONTROL)
        tally.length  = buf.readInt16LE(this._LENGTH)
        tally.display.text = buf.toString('ascii', this._LENGTH+2)

        tally.display.rh_tally     = (tally.control >> 0 & 0b11);
		tally.display.text_tally   = (tally.control >> 2 & 0b11);
		tally.display.lh_tally     = (tally.control >> 4 & 0b11);
		tally.display.brightness   = (tally.control >> 6 & 0b11);
		tally.display.reserved     = (tally.control >> 8 & 0b1111111);
		tally.display.control_data = (tally.control >> 15 & 0b1);

        this.emit('message',tally)
    }

    constructPacket(tally) {
        let bufUMD = Buffer.alloc(12)

        if (!tally.index) { 
            tally.index = 1 //default to index 1
        }
    
        bufUMD.writeUInt16LE(tally.screen, this._SCREEN) 
        bufUMD.writeUInt16LE(tally.index,  this._INDEX)  
    
        if (tally.display) {
            let display = tally.display
    
            if (display.text){
                let text    = Buffer.from(display.text)
                let lenText = Buffer.byteLength(text)
    
                bufUMD.writeUInt16LE(lenText, this._LENGTH)
                bufUMD = Buffer.concat([bufUMD, text]) //append text
            }
            if (!display.brightness) {
                display.brightness = 3 //default to brightness 3
            }

            let control = 0x00
            control |= display.rh_tally << 0
            control |= display.text_tally << 2
            control |= display.lh_tally << 4
            control |= display.brightness << 6

            bufUMD.writeUInt16LE(control, this._CONTROL)
        }
        //Calc length and write PBC
        let msgLength = Buffer.byteLength(bufUMD) - 2
        bufUMD.writeUInt16LE(msgLength, this._PBC)

        return bufUMD
    }

    sendTallyUDP(ip, port, tally) {
        try {		
            if (!ip | !port | !tally){
                throw 'Missing Parameter from call sendTallyUDP()'
            }
            let msg = this.constructPacket(tally)
    
            let client = dgram.createSocket('udp4');
            
            client.send(msg, port, ip, function(error) {
                if (error) {
                    debug('Error sending TSL 5 UDP tally:', error)
                } else {
                    debug('TSL 5 UDP Data sent.');
                }
                client.close();
            });
        }
        catch (error) {
            debug('Error sending TSL 5 UDP tally:', error);
        }
    }
}

// Legacy

function tslumd(port) {

		var self = this;
	
		self.port = port;
		self.parser = packet.createParser();
		self.server = dgram.createSocket('udp4');
		self.parser.packet('tsl', 'b8{x1, b7 => address},b8{x2, b2 => brightness, b1 => tally4, b1 => tally3, b1 => tally2, b1 => tally1 }, b8[16] => label');
	
		self.server.on('error', (err) => {
			debug('error',err);
			throw err;
			self.server.close();
		});
	
		self.server.on('message', (msg, rinfo) => {
			self.parser.extract("tsl", function (res) {
				res.label = new Buffer(res.label).toString();
				res.sender = rinfo.address;
				self.emit('message', res);
			});
			self.parser.parse(msg);
		});
	
		self.server.on('listening', () => {
			var address = self.server.address();
			console.log(`server listening ${address.address}:${address.port}`);
		});
	
		self.server.bind(self.port);
	
	}

util.inherits(tslumd, EventEmitter);

exports.TSL5 = TSL5;
exports.tslumd = tslumd;
exports.TSL3 = TSL3;
