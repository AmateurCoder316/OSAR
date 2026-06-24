import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
 getFirestore,
 collection,
 doc,
 onSnapshot,
 setDoc,
 updateDoc,
 getDoc,
 deleteDoc,
 getDocs
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const firebaseConfig = {
 apiKey:"AIzaSyAomxby71sI_MRqysoTmeM91ow-KleW0",
 authDomain:"osar-3488c.firebaseapp.com",
 projectId:"osar-3488c",
 storageBucket:"osar-3488c.appspot.com",
 messagingSenderId:"700544156659",
 appId:"1:700544156659:web:94f113ed4d82c5380dc886"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ---------------- USER ----------------

let userId = localStorage.getItem("user");

if (!userId) {
 userId = crypto.randomUUID();
 localStorage.setItem("user", userId);
}

let isAdmin = false;

// ---------------- DOM ----------------

const stockList = document.getElementById("stockList");
const ticker = document.querySelector(".ticker-track");
const balanceBox = document.getElementById("balanceBox");
const portfolioBox = document.getElementById("portfolio");

const adminPanel = document.getElementById("adminPanel");
const usersPanel = document.getElementById("usersPanel");
const usersList = document.getElementById("usersList");

const stockName = document.getElementById("stockName");
const stockPrice = document.getElementById("stockPrice");
const addStockBtn = document.getElementById("addStock");

// ---------------- USER INIT ----------------

async function initUser() {
 const ref = doc(db, "users", userId);
 const snap = await getDoc(ref);

 if (!snap.exists()) {
  await setDoc(ref, {
   balance: 10000,
   portfolio: {},
   role: "user"
  });
 }

 const userData = (await getDoc(ref)).data();

 isAdmin = userData?.role === "admin";

 if (isAdmin) {
  adminPanel.classList.remove("hidden");
  usersPanel.classList.remove("hidden");
  loadUsers();
 }

 loadUser();
}

// ---------------- USER DATA ----------------

async function loadUser() {
 const snap = await getDoc(doc(db, "users", userId));
 const user = snap.data();

 balanceBox.innerHTML = `💰 $${user.balance}`;

 let html = "";

 for (let stock in user.portfolio) {
  html += `<div>${stock}: ${user.portfolio[stock]}</div>`;
 }

 portfolioBox.innerHTML = html || "No stocks";
}

// ---------------- HISTORY ----------------

async function addHistory(ref, stock, newPrice) {
 let history = stock.priceHistory || [];

 history.push(newPrice);

 if (history.length > 30)
  history.shift();

 await updateDoc(ref, { priceHistory: history });
}

async function changePrice(ref, stock, type) {
 let change = Math.random() * 0.05;
 let price = stock.price;

 if (type === "buy") price *= 1 + change;
 if (type === "sell") price *= 1 - change;

 price = Math.max(1, Math.round(price));

 await updateDoc(ref, { price });

 await addHistory(ref, stock, price);
}

// ---------------- BUY ----------------

window.buyStock = async (name, id) => {
 const userRef = doc(db, "users", userId);
 const stockRef = doc(db, "stocks", id);

 const user = (await getDoc(userRef)).data();
 const stock = (await getDoc(stockRef)).data();

 if (user.balance < stock.price)
  return alert("Not enough money");

 if (stock.amount <= 0)
  return alert("Sold out");

 let portfolio = user.portfolio || {};

 portfolio[name] = (portfolio[name] || 0) + 1;

 await updateDoc(userRef, {
  balance: user.balance - stock.price,
  portfolio
 });

 await updateDoc(stockRef, {
  amount: stock.amount - 1
 });

 await changePrice(stockRef, stock, "buy");

 loadUser();
};

// ---------------- SELL ----------------

window.sellStock = async (name) => {
 const userRef = doc(db, "users", userId);
 const user = (await getDoc(userRef)).data();

 let portfolio = user.portfolio || {};

 if (!portfolio[name])
  return alert("You don't own this");

 const stocks = await getDocs(collection(db, "stocks"));

 let id;
 let stock;

 stocks.forEach(d => {
  if (d.data().name === name) {
   id = d.id;
   stock = d.data();
  }
 });

 const stockRef = doc(db, "stocks", id);

 portfolio[name]--;

 if (portfolio[name] <= 0)
  delete portfolio[name];

 await updateDoc(userRef, {
  balance: user.balance + stock.price,
  portfolio
 });

 await updateDoc(stockRef, {
  amount: stock.amount + 1
 });

 await changePrice(stockRef, stock, "sell");

 loadUser();
};

// ---------------- CHARTS ----------------

const charts = {};

function makeChart(id, data) {
 const canvas = document.getElementById(`chart-${id}`);
 if (!canvas) return;

 if (charts[id]) charts[id].destroy();

 charts[id] = new Chart(canvas, {
  type: "line",
  data: {
   labels: data.map((_, i) => i),
   datasets: [{
    label: "Price",
    data,
    borderColor: "#00ffff",
    backgroundColor: "rgba(0,255,255,.15)",
    tension: .35
   }]
  },
  options: {
   responsive: true,
   plugins: { legend: { display: false } }
  }
 });
}

// ---------------- STOCKS ----------------

function loadStocks() {
 onSnapshot(collection(db, "stocks"), snapshot => {

  stockList.innerHTML = "";
  let tickerText = "";

  snapshot.forEach(d => {

   const s = d.data();

   tickerText += `📈 ${s.name} $${s.price}   `;

   const div = document.createElement("div");
   div.className = "stock";

   div.innerHTML = `
    <b>${s.name}</b><br>
    💵 $${s.price}<br>
    📦 ${s.amount}<br>

    <button onclick="buyStock('${s.name}','${d.id}')">BUY</button>
    <button onclick="sellStock('${s.name}')">SELL</button>

    <canvas id="chart-${d.id}"></canvas>
   `;

   stockList.appendChild(div);

   setTimeout(() => {
    if (s.priceHistory) makeChart(d.id, s.priceHistory);
   }, 50);

   // ADMIN BUTTONS
   if (isAdmin) {
    const edit = document.createElement("button");
    edit.innerText = "EDIT";

    edit.onclick = async () => {
     let p = prompt("Price", s.price);
     let a = prompt("Amount", s.amount);

     await updateDoc(doc(db, "stocks", d.id), {
      price: Number(p),
      amount: Number(a)
     });
    };

    const del = document.createElement("button");
    del.innerText = "DELETE";

    del.onclick = async () => {
     await deleteDoc(doc(db, "stocks", d.id));
    };

    div.appendChild(edit);
    div.appendChild(del);
   }
  });

  if (ticker)
   ticker.innerHTML = tickerText;
 });
}

// ---------------- ADD STOCK ----------------

addStockBtn.onclick = async () => {

 let name = stockName.value;
 let price = Number(stockPrice.value);
 let amount = Number(prompt("Amount"));

 if (!name || !price || !amount)
  return;

 await setDoc(doc(db, "stocks", name.toLowerCase()), {
  name,
  price,
  amount,
  priceHistory: [price]
 });

 stockName.value = "";
 stockPrice.value = "";
};

// ---------------- USERS ----------------

async function loadUsers() {
 const snap = await getDocs(collection(db, "users"));

 usersList.innerHTML = "";

 snap.forEach(d => {
  const u = d.data();

  const div = document.createElement("div");
  div.className = "stock";

  div.innerHTML = `
   ${d.id}<br>
   💰 ${u.balance}
  `;

  const btn = document.createElement("button");
  btn.innerText = "EDIT MONEY";

  btn.onclick = async () => {
   let money = prompt("Balance", u.balance);

   await updateDoc(doc(db, "users", d.id), {
    balance: Number(money)
   });
  };

  div.appendChild(btn);
  usersList.appendChild(div);
 });
}

// ---------------- START ----------------

initUser().then(() => {
 loadStocks();
});
