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


// 🔥 Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyAomxby81sI_MRqysoTmeM91ow-KleW0",
  authDomain: "osar-3488c.firebaseapp.com",
  projectId: "osar-3488c",
  storageBucket: "osar-3488c.appspot.com",
  messagingSenderId: "700544156659",
  appId: "1:700544156659:web:94f113ed4d82c5380dc886"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);


// 📦 DOM
const stockList = document.getElementById("stockList");
const adminPanel = document.getElementById("adminPanel");
const usersPanel = document.getElementById("usersPanel");
const usersList = document.getElementById("usersList");

const stockName = document.getElementById("stockName");
const stockPrice = document.getElementById("stockPrice");
const addStockBtn = document.getElementById("addStock");

const portfolioBox = document.getElementById("portfolio");
const balanceBox = document.getElementById("balanceBox");


// 👤 USER
const userId = localStorage.getItem("user") || "guest";
const isAdmin = userId === "Roni";

if (isAdmin) {
  adminPanel.classList.remove("hidden");
  usersPanel.classList.remove("hidden");
  loadUsers();
}


// 💰 INIT USER
async function initUser() {
  const ref = doc(db, "users", userId);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    await setDoc(ref, {
      balance: 0,
      portfolio: {}
    });
  }

  loadUser();
}


// 📊 USER UI
async function loadUser() {
  const ref = doc(db, "users", userId);
  const snap = await getDoc(ref);
  const data = snap.data();

  balanceBox.innerHTML = `💰 Kassa: $${data.balance}`;

  let html = "";
  for (let key in data.portfolio) {
    html += `<div>${key}: ${data.portfolio[key]}</div>`;
  }

  portfolioBox.innerHTML = html || "Osta ensimmäinen osake valitsemalla osake ja painamalla OSTA!";
}


// 📈 UPDATE PRICE + HISTORY
function pushHistory(stockRef, stock, newPrice) {
  const history = stock.priceHistory || [];
  history.push(newPrice);

  if (history.length > 30) history.shift();

  updateDoc(stockRef, {
    priceHistory: history
  });
}


// 📈 PRICE IMPACT
async function updatePrice(stockRef, stock, type) {
  let change = Math.random() * 0.05;

  let newPrice =
    type === "buy"
      ? stock.price * (1 + change)
      : stock.price * (1 - change);

  newPrice = Math.max(1, Math.round(newPrice));

  await updateDoc(stockRef, {
    price: newPrice
  });

  pushHistory(stockRef, stock, newPrice);
}


// 💰 BUY
window.buyStock = async (name, price, stockId) => {
  const userRef = doc(db, "users", userId);
  const stockRef = doc(db, "stocks", stockId);

  const userSnap = await getDoc(userRef);
  const stockSnap = await getDoc(stockRef);

  const user = userSnap.data();
  const stock = stockSnap.data();

  if (user.balance < stock.price) return alert("Ei tarpeeksi rahaa!");
  if (stock.amount <= 0) return alert("Ei osakkeita jäljellä!");

  const portfolio = user.portfolio || {};
  portfolio[name] = (portfolio[name] || 0) + 1;

  await updateDoc(userRef, {
    balance: user.balance - stock.price,
    portfolio
  });

  await updateDoc(stockRef, {
    amount: stock.amount - 1
  });

  updatePrice(stockRef, stock, "buy");
  loadUser();
};


// 💸 SELL
window.sellStock = async (name, price) => {
  const userRef = doc(db, "users", userId);
  const userSnap = await getDoc(userRef);
  const user = userSnap.data();

  const portfolio = user.portfolio || {};

  if (!portfolio[name]) return alert("Et omista tätä osaketta!");

  const snap = await getDocs(collection(db, "stocks"));

  let stockDocId = null;
  let stockData = null;

  snap.forEach((d) => {
    if (d.data().name === name) {
      stockDocId = d.id;
      stockData = d.data();
    }
  });

  const stockRef = doc(db, "stocks", stockDocId);

  portfolio[name] -= 1;
  if (portfolio[name] <= 0) delete portfolio[name];

  await updateDoc(userRef, {
    balance: user.balance + stockData.price,
    portfolio
  });

  await updateDoc(stockRef, {
    amount: stockData.amount + 1
  });

  updatePrice(stockRef, stockData, "sell");
  loadUser();
};


// 📊 REAL CHARTS (Chart.js)
const charts = {};

function renderChart(id, history) {
  const ctx = document.getElementById(`chart-${id}`).getContext("2d");

  if (charts[id]) {
    charts[id].destroy();
  }

  charts[id] = new Chart(ctx, {
    type: "line",
    data: {
      labels: history.map((_, i) => i + 1),
      datasets: [{
        label: "Price",
        data: history,
        borderColor: "#00ffcc",
        backgroundColor: "rgba(0,255,204,0.1)",
        tension: 0.3
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false }
      },
      scales: {
        x: { display: false },
        y: { beginAtZero: false }
      }
    }
  });
}


// 📡 STOCK LIST
function loadStocks() {
  const stocksRef = collection(db, "stocks");

  onSnapshot(stocksRef, (snapshot) => {
    stockList.innerHTML = "";

    snapshot.forEach((docSnap) => {
      const s = docSnap.data();

      const div = document.createElement("div");
      div.classList.add("stock");

      div.innerHTML = `
        <div>
          <b>${s.name}</b> - $${s.price}
          <br>
          📦 ${s.amount}
        </div>

        <div>
          <button onclick="buyStock('${s.name}', ${s.price}, '${docSnap.id}')">Buy</button>
          <button onclick="sellStock('${s.name}', ${s.price})">Sell</button>
        </div>

        <div class="chart-box">
          <canvas id="chart-${docSnap.id}"></canvas>
        </div>
      `;

      stockList.appendChild(div);

      setTimeout(() => {
        if (s.priceHistory && s.priceHistory.length > 1) {
          renderChart(docSnap.id, s.priceHistory);
        }
      }, 0);

      // ADMIN
      if (isAdmin) {
        const editBtn = document.createElement("button");
        editBtn.textContent = "Edit";

        editBtn.onclick = async () => {
          const newPrice = prompt("New price:", s.price);
          const newAmount = prompt("New amount:", s.amount);

          if (!newPrice || !newAmount) return;

          await updateDoc(doc(db, "stocks", docSnap.id), {
            price: Number(newPrice),
            amount: Number(newAmount)
          });
        };

        const deleteBtn = document.createElement("button");
        deleteBtn.textContent = "Delete";

        deleteBtn.onclick = async () => {
          await deleteDoc(doc(db, "stocks", docSnap.id));
        };

        div.appendChild(editBtn);
        div.appendChild(deleteBtn);
      }
    });
  });
}


// ➕ ADD STOCK
addStockBtn.addEventListener("click", async () => {
  if (!isAdmin) return;

  const name = stockName.value;
  const price = Number(stockPrice.value);
  const amount = Number(prompt("How many shares?"));

  if (!name || !price || !amount) return;

  await setDoc(doc(db, "stocks", name.toLowerCase()), {
    name,
    price,
    amount,
    priceHistory: [price]
  });

  stockName.value = "";
  stockPrice.value = "";
});


// 👥 USERS
async function loadUsers() {
  const snap = await getDocs(collection(db, "users"));

  usersList.innerHTML = "";

  snap.forEach((userDoc) => {
    const user = userDoc.data();

    const div = document.createElement("div");
    div.classList.add("stock");

    div.innerHTML = `
      <span>${userDoc.id}</span>
      <span>💰 $${user.balance}</span>
    `;

    const btn = document.createElement("button");
    btn.textContent = "Edit Balance";

    btn.onclick = async () => {
      const newBalance = prompt("New balance:", user.balance);
      if (newBalance === null) return;

      await updateDoc(doc(db, "users", userDoc.id), {
        balance: Number(newBalance)
      });

      loadUsers();
    };

    div.appendChild(btn);
    usersList.appendChild(div);
  });
}


// 🚀 START
initUser();
loadStocks();