
/**
 * Module dependencies.
 */

var express = require('express');
var routes = require('./routes');
var user = require('./routes/user');
var http = require('http');
var path = require('path');
var socketio = require('socket.io');

var app = express();

// all environments
app.set('port', process.env.PORT || 3000);
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.use(express.favicon());
app.use(express.logger('dev'));
app.use(express.json());
app.use(express.urlencoded());
app.use(express.methodOverride());
app.use(app.router);
app.use(express.static(path.join(__dirname, 'public')));

// development only
if ('development' == app.get('env')) {
  app.use(express.errorHandler());
}

app.get('/', routes.index);

var server = http.createServer(app);
server.listen(app.get('port'), function(){
  console.log('Express server listening on port ' + app.get('port'));
});

var io = socketio.listen(server);

var userCount = 0;
var userIdx = 0;
var roomIdx = 0;
var rooms = {};

io.sockets.on('connection', function(socket){

	var socketId = socket.id;
	var userId = (++userIdx).toString();
	var name = 'guest_' + userId;
	var roomId = "";

	io.sockets.emit('allUserCount', ++userCount);
	socket.emit('roomList', rooms);
	socket.emit('name', name);

	socket.on('make', function(roomName){
		leave();
		roomId = makeRoom(roomName);
		join();
	});

	socket.on('join', function(rid){
		roomId = rid;
		join();
	});

	socket.on('leave', function(){
		leave();
	});

	socket.on('message', function(msg){
		io.sockets.in(roomId).emit('message', {'name' : name, 'text' : msg});
	});

	socket.on('whisper', function(data){
		var user = rooms[roomId].users[data.toId];
		console.log('======================> toSocId : ' + user.socketId);

		socket.emit('whisper', {'toName' : user.name, 'fromName' : name, 'text' : data.text});
		io.sockets.sockets[user.socketId].emit('whisper', {'toName' : user.name, 'fromName' : name, 'text' : data.text});
	});

	socket.on('change', function(nm){
		var room = rooms[roomId];
		notify('[' + name + '] change name to [' + nm + ']');
		name = nm;
		room.users[userId].name = nm;
		socket.emit('name', name);
		io.sockets.in(roomId).emit('userList', room.users);
	});

	socket.on('disconnect', function() {
		io.sockets.emit('allUserCount', --userCount);
		leave();
		console.log('disconnect');
	});

	function notify(message, isAll) {
		if(isAll) {
			io.sockets.emit('notify', '** ' + message + ' **');
		} else {
			io.sockets.in(roomId).emit('notify', '** ' + message + ' **');
		}
	};

	function makeRoom(rn) {
		var rid = (++roomIdx).toString();
		var o = {};
		o.id = rid;
		o.name = rn;
		o.users = {};
		o.count = 0;
		rooms[rid] = o;
		io.sockets.emit('roomList', rooms);
		return rid;
	};

	function removeRoom(id) {
		delete rooms[id];
		io.sockets.emit('roomList', rooms);
	};

	function join() {
		socket.join(roomId);
		var room = rooms[roomId];
		room.users[userId] = {'userId' : userId, 'socketId' : socketId, 'name' : name}; 
		room.count++;
		socket.broadcast.to(roomId).emit('userList', room.users);
		socket.emit('joined', room);
		notify('[' + name + ']' + ' join.');
	};

	function leave() {
		if(roomId != "") {
			var room = rooms[roomId];

			delete room.users[userId];
			room.count--;

			if(room.count > 0) {
				socket.broadcast.to(roomId).emit('userList', room.users);
			} else {
				removeRoom(roomId);
			}
			notify('[' + name + ']' + ' leave.');
			socket.emit('leaved');
			socket.leave(roomId);
			roomId = "";
		}
	};
});



