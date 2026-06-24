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
 getDocs,
 addDoc
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const firebaseConfig={
 apiKey:"AIzaSyAomxby81t2sI_MRqysoTmeM91ow-KleW0",
 authDomain:"osar-3488c.firebaseapp.com",
 projectId:"osar-3488c",
 storageBucket:"osar-3488c.appspot.com",
 messagingSenderId:"700544156659",
 appId:"1:700544156659:web:94f113ed4d82c5380dc886"
};

const app=initializeApp(firebaseConfig);
const db=getFirestore(app);

const stockList=document.getElementById("stockList");
const ticker=document.querySelector(".ticker-track");
const balanceBox=document.getElementById("balanceBox");
const portfolioBox=document.getElementById("portfolio");

const adminPanel=document.getElementById("adminPanel");
const usersPanel=document.getElementById("usersPanel");
const usersList=document.getElementById("usersList");

const stockName=document.getElementById("stockName");
const stockPrice=document.getElementById("stockPrice");
const addStockBtn=document.getElementById("addStock");

const userId=localStorage.getItem("user")||"guest";
const isAdmin=userId==="Roni";

if(isAdmin){
 adminPanel.classList.remove("hidden");
 usersPanel.classList.remove("hidden");
 loadUsers();
 loadRequests();
}

async function initUser(){
 const ref=doc(db,"users",userId);
 const snap=await getDoc(ref);

 if(!snap.exists()){
  await setDoc(ref,{
   balance: 0,
   portfolio:{}
  });
 }

 loadUser();
}

async function loadUser(){
 const snap=await getDoc(doc(db,"users",userId));
 const user=snap.data();

 balanceBox.innerHTML=`💰 $${user.balance}`;

 let html="";

 for(let stock in user.portfolio){
  html+=`<div>${stock}: ${user.portfolio[stock]}</div>`;
 }

 portfolioBox.innerHTML=html||"No stocks";
}

window.buyStock=async(name,id)=>{

 const stock=(await getDoc(doc(db,"stocks",id))).data();
 const user=(await getDoc(doc(db,"users",userId))).data();

 let amount=Number(prompt("Valitse osakkeiden määrä?",1));

 if(!amount||amount<=0)
  return;

 if(user.balance<stock.price*amount)
  return alert("Ei riittävästi rahaa!");

 if(stock.amount<amount)
  return alert("Ei tarpeeksi osakkeita jäljellä!");


 await addDoc(collection(db,"requests"),{
  user:userId,
  type:"buy",
  stock:name,
  stockId:id,
  price:stock.price,
  amount,
  status:"pending",
  time:Date.now()
 });

 alert("Tapahtuma pyyntö lähetty, odota hyväksyntää.");
}

window.sellStock=async(name)=>{

 const user=(await getDoc(doc(db,"users",userId))).data();

 if(!user.portfolio[name])
  return alert("Et omista tätä osaketta!");

 let amount=Number(prompt("Valitse osakkeiden määrä?",1));

 if(!amount||amount<=0)
  return;

 if(user.portfolio[name]<amount)
  return alert("Sinulla ei ole tarpeeksi");

 const stocks=await getDocs(collection(db,"stocks"));

 let id;
 let stock;

 stocks.forEach(d=>{
  if(d.data().name===name){
   id=d.id;
   stock=d.data();
  }
 });

 await addDoc(collection(db,"requests"),{
  user:userId,
  type:"sell",
  stock:name,
  stockId:id,
  price:stock.price,
  amount,
  status:"pending",
  time:Date.now()
 });

 alert("Pyyntö lähetetty, odota hyväksyntää.");
}

async function acceptRequest(id,r){

 const userRef=doc(db,"users",r.user);
 const stockRef=doc(db,"stocks",r.stockId);

 const user=(await getDoc(userRef)).data();
 const stock=(await getDoc(stockRef)).data();

 let portfolio=user.portfolio||{};

 if(r.type==="buy"){

  let total=stock.price*r.amount;

  if(user.balance<total)
   return;

  if(stock.amount<r.amount)
   return;

  portfolio[r.stock]=(portfolio[r.stock]||0)+r.amount;

  await updateDoc(userRef,{
   balance:user.balance-total,
   portfolio
  });

  await updateDoc(stockRef,{
   amount:stock.amount-r.amount
  });
 }

 if(r.type==="sell"){

  if(!portfolio[r.stock]||portfolio[r.stock]<r.amount)
   return;

  let total=stock.price*r.amount;

  portfolio[r.stock]-=r.amount;

  if(portfolio[r.stock]<=0)
   delete portfolio[r.stock];

  await updateDoc(userRef,{
   balance:user.balance+total,
   portfolio
  });

  await updateDoc(stockRef,{
   amount:stock.amount+r.amount
  });
 }

 await updateDoc(doc(db,"requests",id),{
  status:"accepted"
 });

 loadUser();
}


function loadRequests(){

onSnapshot(collection(db,"requests"),snapshot=>{

if(!isAdmin)
 return;

const oldRequests=document.getElementById("requests");

if(oldRequests)
 oldRequests.remove();

const requestBox=document.createElement("div");
requestBox.id="requests";

adminPanel.appendChild(requestBox);

snapshot.forEach(d=>{

const r=d.data();

if(r.status!=="pending")
 return;

const box=document.createElement("div");

box.className="stock";


box.innerHTML=`
<b>TRADE REQUEST</b>
<br>
👤 ${r.user}
<br>
${r.type.toUpperCase()} ${r.stock}
<br>
Amount: ${r.amount}
<br>
Price: $${r.price}
`;


const accept=document.createElement("button");

accept.innerText="Hyväksy";


accept.onclick=async()=>{

await acceptRequest(d.id,r);

};



const reject=document.createElement("button");

reject.innerText="Kiellä";


reject.onclick=async()=>{

await updateDoc(doc(db,"requests",d.id),{
 status:"rejected"
});

};


box.appendChild(accept);
box.appendChild(reject);

requestBox.appendChild(box);

});

});

}



// CHARTS

const charts={};

function makeChart(id,data){

const canvas=document.getElementById(`chart-${id}`);

if(!canvas)
 return;


if(charts[id])
 charts[id].destroy();


charts[id]=new Chart(canvas,{
 type:"line",
 data:{
  labels:data.map((_,i)=>i),
  datasets:[{
   label:"Price",
   data,
   borderColor:"#00ffff",
   backgroundColor:"rgba(0,255,255,.15)",
   tension:.35
  }]
 },
 options:{
  responsive:true,
  plugins:{
   legend:{
    display:false
   }
  }
 }
});

}

function loadStocks(){

onSnapshot(collection(db,"stocks"),snapshot=>{

stockList.innerHTML="";

let tickerText="";

snapshot.forEach(d=>{

const s=d.data();

tickerText+=`📈 ${s.name} $${s.price}   `;

const div=document.createElement("div");

div.className="stock";

div.innerHTML=`

<b>${s.name}</b>

<br>

💵 $${s.price}

<br>

📦 ${s.amount}

<br>


<button onclick="buyStock('${s.name}','${d.id}')">
BUY
</button>


<button onclick="sellStock('${s.name}')">
SELL
</button>


<canvas id="chart-${d.id}">
</canvas>

`;

stockList.appendChild(div);

setTimeout(()=>{

if(s.priceHistory)
 makeChart(d.id,s.priceHistory);

},50);

if(isAdmin){

const edit=document.createElement("button");

edit.innerText="Muokkaa";

edit.onclick=async()=>{

let p=prompt("Price",s.price);
let a=prompt("Amount",s.amount);

await updateDoc(doc(db,"stocks",d.id),{
 price:Number(p),
 amount:Number(a)
});

};

const del=document.createElement("button");

del.innerText="Poista";

del.onclick=async()=>{

await deleteDoc(doc(db,"stocks",d.id));

};

div.appendChild(edit);
div.appendChild(del);

}

});

if(ticker)
 ticker.innerHTML=tickerText;

});

}

addStockBtn.onclick=async()=>{

let name=stockName.value;

let price=Number(stockPrice.value);

let amount=Number(prompt("Määrä"));


if(!name||!price||!amount)
 return;

await setDoc(doc(db,"stocks",name.toLowerCase()),{

name,
price,
amount,
priceHistory:[price]

});


stockName.value="";
stockPrice.value="";

}

async function loadUsers(){

const snap=await getDocs(collection(db,"users"));

usersList.innerHTML="";


snap.forEach(d=>{

const u=d.data();


const div=document.createElement("div");

div.className="stock";


div.innerHTML=`

${d.id}

<br>

💰 ${u.balance}

`;



const btn=document.createElement("button");

btn.innerText="Muokkaa kassaa";


btn.onclick=async()=>{

let money=prompt(
"Kassa",
u.balance
);


await updateDoc(doc(db,"users",d.id),{
 balance:Number(money)
});

};

div.appendChild(btn);

usersList.appendChild(div);
});

}

initUser();
loadStocks();
