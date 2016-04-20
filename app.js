
var app = require('express')();
var server = require('http').createServer(app);

var virtualDirPath = process.env.virtualDirPath || '';
var io = require('socket.io')(server, { path: virtualDirPath + '/socket.io' });
var bodyParser = require('body-parser');
var jwt = require('jsonwebtoken');
var bcrypt = require('bcrypt-nodejs');

//Создаем новую бд и коллекцию в памяти при каждом запуске ноды
var loki = require('lokijs');
var db = new loki("loki.db");
var users = db.addCollection('users');

//Заполняем базу пустыми данными(нужно для генерации мест на клиенте)
var seats = db.addCollection('seats');
for (var i = 1; i < 26; i++) {
   seats.insert({
        pos: i,
        name: false,
        color: '#fff' 
      });       
}


//Секретный ключ для подписи токена
var secret = 'super_secret_key';

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));


server.listen(process.env.PORT || 8080, function () {
  console.log('Подняли сервер на *:80');
});


app.get('/', function (req, res) {
  res.sendFile(__dirname + '/index.html');
});

        
app.get('/style.css', function (req, res) {
  res.sendFile(__dirname + '/style.css');
});

app.get('/index.js', function (req, res) {
  res.sendFile(__dirname + '/index.js');
});

//Безопасно только при использовании защищенного соединения
app.post('/api/users', function (req, res, next) {  
  
  var username = req.body.username;
  var password = req.body.password;
  //bcrypt sync password hash
  console.log(1);
  var hash = bcrypt.hashSync(password);
  console.log(2);
  //Проверяем существует ли пользователь в бд
  var user = users.findOne({'name':  username});  
  
   //Если нет в бд - заносим в базу вместе с цветом
   if(!user){
      var rnd_color = '#' + Math.floor(Math.random()*16777215).toString(16)
      users.insert({
        name: username,
        hash: hash, //todo hash pass
        color: rnd_color //рандомный цвет
      });       
      console.log(hash);
    }else if(user.name === username){
      //Todo отслеживание неправильных попыток, и блокировака по ip
      // на некоторое время для защиты от брутфорса
      
      //Чекаем хеш
      var chk = bcrypt.compareSync(password, user.hash);
      if(!chk){
        //Не удалось авторизоваться, отдаем http статус 401   
        res.sendStatus(401); 
        return;       
      }   
    }
    
    //генерируем токен для пользователя
    var user_data = {
      username: username,
      color: rnd_color || user.color
    };          
    var token = jwt.sign(user_data, secret, {expiresIn: 30*60}); 
    
    res.json({token: token});  
});


//Проверка валидности токена
io.use(
  require('socketio-jwt').authorize({
  secret: secret,
  handshake: true
}));

io.on('connection', function (socket) {
    //Отправляем данные для генерации таблицы мест
    socket.emit('start', seats.data);
    socket.on('reserve', function (data) {
      
      //получаем количество забронированных мест у пользователя
      var user_seats = seats.find({'name':{'$eq': socket.decoded_token.username}}).length;
      
      //проверяем можно ли зарезервировать место
      var seat = seats.findOne({'pos': { '$eq' :  parseInt(data.id)}});
      //Проверяем статус места
      if(seat.name === false && user_seats < 5){
        //место свободно, занимаем его и отправляем инфу всем клиентам
        seat.name = socket.decoded_token.username;
        seat.color = socket.decoded_token.color;
        seats.update(seat);
        io.sockets.emit('seat taken',{
          pos: data.id,
          color: socket.decoded_token.color,
          name: socket.decoded_token.username
        });
        return;   
      }else if(seat.name === socket.decoded_token.username){
        //Снимаем бронь
        seat.name = false;    
        seat.color = "#fff"; 
        seats.update(seat);
        io.sockets.emit('seat taken',{
          pos: data.id,
          color: "#fff",
          name: false
        });  
        return;
      }else{
        //место занято        
      }
      
      if(user_seats == 5){
        //Юзер занял слишком много мест
        socket.emit('maximum seats');
        return;
      }      
      
    });    

    console.log('В базе пользователей:', users.count());    
});
