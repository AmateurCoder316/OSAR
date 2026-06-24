const users = [
  { username: "Roni", password: "Roni2012" },
  { username: "Kalevi", password: "K13OSAR?" },
  { username: "Aleksi", password: "A13OSAR!" }
];

let username = document.getElementById("username");
let password = document.getElementById("password");
let loginButton = document.getElementById("loginButton");
let userFound = false

loginButton.addEventListener("click", function(event) {
  users.forEach(function(user) {
    if (user.username == username.value) {
      if (user.password == password.value) {
        console.log('Login succesful')
        userFound = true
        localStorage.setItem("user", username.value);
        window.location.href = './home.html'
      } else {
        console.log('Incorrect password, try again!')
        userFound = true
      }
    } 
  });
  if (!userFound) {
    console.log('User not found.')
  }
});