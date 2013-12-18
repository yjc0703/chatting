
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
app.get('/users', user.list);

var server = http.createServer(app);
server.listen(app.get('port'), function(){
  console.log('Express server listening on port ' + app.get('port'));
});

var io = socketio.listen(server);

var userCount = 0;
var userIdx = 0;
var roomId = 0;
var roomList = [];
var userList = {};

io.sockets.on('connection', function(socket){

	var addUser = function(room, socket) {
		socket.get('name', function(err, name){
			if(name == null) {
				name = 'guest';
				socket.set('name', name);
				socket.emit('name', name);
			}
			userList[room].push({'id':socket.id, 'name':name});
		});
	};

	var delUser = function (room, socket) {		
		socket.leave(room);
		var ua = [];
		userList[room].forEach(function(e, i){
			if(e.id != socket.id) ua.push(e);
		});
		userList[room] = ua;
	};

	var changeUser = function(room, socket, name) {
		var idx = -1;
		userList[room].forEach(function(e, i){
			if(e.id == socket.id) {
				idx = i;
			}
		});

		if(idx >= 0) userList[room][idx].name = name;
	};

	var addRoom = function(rn) {
		var rid = (++roomId).toString();
		var o = {'id' : rid, 'name' : rn};
		roomList.push(o);
		userList[rid] = [];
		return rid;
	};

	var delRoom = function(id) {		
		var i = roomList.length;
		var aa = [];
		while(i-- > 0) {
			if(roomList[i].id != id) aa.push(roomList[i]);
		}
		roomList = aa;
	};

	io.sockets.emit('allUserCount', ++userCount);
	socket.emit('roomList', JSON.stringify(roomList));
	var userName = 'guest_' + (++userIdx);
	socket.set('name', userName);
	socket.emit('name', userName);

	socket.on('message', function(text){
		socket.get('room', function(err, room){
			if(room == null) {
				return false;
			}
			socket.get('name', function(err, name){
				if(name == null) {
					return false;
				}
				io.sockets.in(room).emit('message', {'name' : name, 'text' : text});
			});
		});
	});

	socket.on('join', function(room){
		socket.join(room);
		socket.set('room', room);
		addUser(room, this);
		io.sockets.in(room).emit('userList', JSON.stringify(userList[room]));
		socket.get('name', function(err, name){
			io.sockets.in(room).emit('notify', '[' + name + '] join.');
		});
	});

	socket.on('drop', function(){
		socket.get('room', function(err, room){
			if(room != null) {
				delUser(room, socket);
				io.sockets.in(room).emit('userList', JSON.stringify(userList[room]));
				socket.get('name', function(err, name){
					io.sockets.in(room).emit('notify', '[' + name + '] leave.');
				});
			}
		});
	});

	socket.on('make', function(data){
		var rid = addRoom(data);
		io.sockets.emit('roomList', JSON.stringify(roomList));
		socket.emit('join', rid);
	});

	socket.on('change', function(data){
		var beforeName = '';
		socket.get('name', function(err, name){
			beforeName = name;
		});
		socket.set('name', data);
		socket.get('room', function(err, room){
			if(room != null) {
				changeUser(room, socket, data);
				io.sockets.in(room).emit('userList', JSON.stringify(userList[room]));
				io.sockets.in(room).emit('notify', '[' + beforeName + '] change name to [' + data + ']');
			}
		});
	});

	socket.on('disconnect', function() {
		io.sockets.emit('allUserCount', --userCount);
		socket.get('room', function(err, room){
			if(room != null) {
				delUser(room, socket);
				io.sockets.in(room).emit('userList', JSON.stringify(userList[room]));
				socket.get('name', function(err, name){
					io.sockets.in(room).emit('bye', name);
				});
			}
		});
		console.log('disconnect');
	});
});



