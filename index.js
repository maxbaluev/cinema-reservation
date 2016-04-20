 $(document).ready(function () {
      var socket,token;
      $('#login-modal').modal('show');
      $('#login').prop('disabled', false);
      
      //Логинимся.  
      $('#loginForm').on("submit", function(e) {
        e.preventDefault();
        
        //Не нативная реализация bscrypt очень долго хеширует пароль(несколько секунд), поэтому скрываем кнопку сабмита
        $("#login").css('display','none');
                
        var username = $('input[name=username]').val();
        var password = $('input[name=password]').val();
        if (!username) {
          alert('Вы не ввели логин');
          $("#login").css('display','block');
          return;
        }
        if (!password) {
          alert('Вы не ввели пароль');
          $("#login").css('display','block');
          return;
        }
        
        var user = {
          username: username,
          password: password
        };
        
        //Отправляем запрос с телефоном на сервер, для получения токена
        $.ajax({
          type: 'POST',
          url: '/api/users',
          data: user
        }).done(function (data) {
          token = data.token;
          if (!token) {
            alert('Не удалось авторизоваться.');
            return;
          }
          console.log(token);
          socket = io.connect('/', {
            query: 'token=' + token,
            forceNew: true
          })
          
          socket.on('connect', function (data) {
            console.log('Подключились к вебсокет серверу');
            $('#login-modal').modal('toggle');
            $('.content').css('display','block');
            socket.on('start', function (data) {
              //Смотрим каждый json элемент
              $.each(data, function (key, data) {
                  console.log(data)
                  var html = "<div class='seat' id=" + data.pos + "></div>"
                  $(".squad").append(html);
                  $('#'+data.pos).css('background-color', data.color).attr("taken", data.name);
                  if(data.name === false){
                    $('#'+data.pos).text('');
                  }else{
                    $('#'+data.pos).text(data.name);
                  }
              })
              //Настраиваем действия при наведении
              $(".seat").hover(function(e){
                  if(($(this).attr("taken") === "false") || ($(this).attr("taken") === username)){
                    $(this).css('cursor','pointer');
                  }else{
                    $(this).css('cursor','default');
                  }
              });
              //Настраиваем действия при клике
              $(".seat").click(function(e){
                if(($(this).attr("taken") === "false") || ($(this).attr("taken") === username)){
                  console.log(this.id);
                  socket.emit('reserve', { id: this.id });
                }
              });
              //Логаут
              $("#logout").click(function(e){
                  socket.disconnect();
                  $('.content').css('display','none');
                  $('.squad').html('');
                  $("#login").css('display','block');
                  $('#login-modal').modal('show');
              });
            });
            
            socket.on('seat taken', function(data){
              $('#'+data.pos).css('background-color', data.color).attr("taken",data.name);
              if(data.name === false){
                $('#'+data.pos).text('');
              }else{
                $('#'+data.pos).text(data.name);                
              }
            });
            
            socket.on('maximum seats', function(data){
              alert('Пользователь может занять максимум 5 мест');
            })
          });
          
          socket.on('error', function (err) {
            console.log(JSON.stringify(err));
          });
          
        
        }).fail(function() {
          alert("Неправильный пароль");
        });        
  });
});