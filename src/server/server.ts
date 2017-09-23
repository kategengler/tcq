import * as secrets from './secrets';
import * as express from 'express';
import passport from './passport';
import routes from './router';
import * as socketio from 'socket.io';
import { Server } from 'http';
import * as Session from 'express-session';

const app = express();
const server = new Server(app);
const io = socketio(server);
server.listen(3000);

const sessionStore = new Session.MemoryStore();

const session = Session({
  secret: secrets.SESSION_SECRET,
  store: sessionStore,
  resave: true,
  saveUninitialized: true
});

app.use(require('body-parser').urlencoded({ extended: true }));
app.use(session);
app.use(passport.initialize());
app.use(passport.session());
app.use(routes);
app.use(express.static('dist/client/'));

const currentSpeaker = {
  name: 'Brian Terlson',
  organization: 'Microsoft',
  topic: 'Awesomeness'
};

const queuedSpeakers = [
  {
    name: 'Brian Terlson',
    organization: 'Microsoft',
    topic: 'What is awesome?'
  },
  { name: 'Yehuda Katz', organization: 'Tilde', topic: 'Hello' },
  { name: 'David Herman', organization: 'LinkedIn', topic: 'This is a topic' }
];

io.use(function(socket, next) {
  var req = socket.handshake;
  var res = {};
  session(req as any, res as any, next);
});

let socks = new Set();
io.on('connection', function(socket) {
  socks.add(socket);
  if (!(socket.handshake as any).session || !(socket.handshake as any).session.passport) {
    // not logged in I guess? Or session not found?
    socket.disconnect();
    return;
  }
  let user = (socket.handshake as any).session.passport.user;
  socket.emit('state', { currentSpeaker, queuedSpeakers });
  socket.on('newTopic', function(data: any) {
    socks.forEach(s => {
      const speaker = { name: user.name, organization: user.company, topic: data.topic };
      s.emit('newSpeaker', {
        position: queuedSpeakers.length,
        speaker
      });
      queuedSpeakers.push(speaker);
    });
  });
  socket.on('end', function() {
    console.log('deleting');
    socks.delete(socket);
  });
});

export default app;
