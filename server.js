const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const app = express();
const PORT = 3000;
const SECRET_KEY = "studentpopulationsecret";

app.use(express.json());

// DATABASE
const db = new sqlite3.Database("database.db");

db.serialize(async () => {
  db.run(`
    CREATE TABLE IF NOT EXISTS users(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE,
      password TEXT
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS sections(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      section_name TEXT,
      male INTEGER,
      female INTEGER,
      total INTEGER,
      updated_at TEXT
    )
  `);

  const hashedPassword = await bcrypt.hash("admin123", 10);

  db.run(
    `INSERT OR IGNORE INTO users(username,password)
     VALUES(?,?)`,
    ["admin", hashedPassword]
  );

  db.get(
    "SELECT COUNT(*) as count FROM sections",
    [],
    (err, row) => {
      if (row.count === 0) {
        db.run(`
          INSERT INTO sections
          (section_name,male,female,total,updated_at)
          VALUES
          ('Grade 7-A',20,25,45,DATETIME('now')),
          ('Grade 7-B',18,22,40,DATETIME('now')),
          ('Grade 8-A',15,20,35,DATETIME('now'))
        `);
      }
    }
  );
});

// AUTHENTICATION MIDDLEWARE
function verifyToken(req, res, next) {
  const header = req.headers.authorization;

  if (!header) {
    return res.status(401).json({
      message: "Unauthorized"
    });
  }

  const token = header.split(" ")[1];

  try {
    jwt.verify(token, SECRET_KEY);
    next();
  } catch {
    return res.status(401).json({
      message: "Invalid Token"
    });
  }
}

// LOGIN
app.post("/login", (req, res) => {

  const { username, password } = req.body;

  db.get(
    "SELECT * FROM users WHERE username=?",
    [username],
    async (err, user) => {

      if (!user) {
        return res.status(400).json({
          message: "User not found"
        });
      }

      const match = await bcrypt.compare(
        password,
        user.password
      );

      if (!match) {
        return res.status(400).json({
          message: "Wrong password"
        });
      }

      const token = jwt.sign(
        { id: user.id },
        SECRET_KEY,
        { expiresIn: "1d" }
      );

      res.json({ token });
    }
  );
});

// GET ALL SECTIONS
app.get("/sections", verifyToken, (req, res) => {
  db.all(
    "SELECT * FROM sections",
    [],
    (err, rows) => {
      res.json(rows);
    }
  );
});

// ADD SECTION
app.post("/sections", verifyToken, (req, res) => {

  const {
    section_name,
    male,
    female
  } = req.body;

  const total =
    Number(male) +
    Number(female);

  const date =
    new Date().toLocaleString();

  db.run(
    `
    INSERT INTO sections
    (section_name,male,female,total,updated_at)
    VALUES(?,?,?,?,?)
  `,
    [
      section_name,
      male,
      female,
      total,
      date
    ],
    () => {
      res.json({
        message: "Added"
      });
    }
  );
});

// UPDATE SECTION
app.put("/sections/:id",
verifyToken,
(req, res) => {

  const {
    section_name,
    male,
    female
  } = req.body;

  const total =
    Number(male) +
    Number(female);

  const date =
    new Date().toLocaleString();

  db.run(
    `
    UPDATE sections
    SET
    section_name=?,
    male=?,
    female=?,
    total=?,
    updated_at=?
    WHERE id=?
  `,
    [
      section_name,
      male,
      female,
      total,
      date,
      req.params.id
    ],
    () => {
      res.json({
        message: "Updated"
      });
    }
  );
});

// WEBSITE
app.get("/", (req, res) => {

res.send(`
<!DOCTYPE html>
<html>
<head>
<title>WARM LINK System</title>

<style>

body{
font-family:Arial;
background:#f3f4f6;
padding:30px;
}

.container{
max-width:1100px;
margin:auto;
}

.card{
background:white;
padding:20px;
border-radius:10px;
box-shadow:0 0 10px rgba(0,0,0,0.1);
margin-bottom:20px;
}

input{
padding:10px;
margin:5px;
width:200px;
}

button{
padding:10px;
background:#2563eb;
color:white;
border:none;
cursor:pointer;
border-radius:5px;
}

table{
width:100%;
border-collapse:collapse;
background:white;
}

th,td{
border:1px solid #ddd;
padding:10px;
text-align:center;
}

th{
background:#2563eb;
color:white;
}

.hidden{
display:none;
}

</style>
</head>

<body>

<div class="container">

<div id="loginCard" class="card">

<h2>Login</h2>

<input
id="username"
placeholder="Username">

<input
id="password"
type="password"
placeholder="Password">

<button onclick="login()">
Login
</button>

</div>

<div
id="dashboard"
class="hidden">

<div class="card">

<h1>
WARM LINK System
</h1>

<h3>
Total Student Population:
<span id="population">
0
</span>
</h3>

</div>

<div class="card">

<h3>Add Section</h3>

<input
id="section"
placeholder="Section Name">

<input
id="male"
type="number"
placeholder="Male">

<input
id="female"
type="number"
placeholder="Female">

<button onclick="addSection()">
Add Section
</button>

</div>

<div class="card">

<input
id="search"
placeholder="Search Section"
onkeyup="loadSections()">

</div>

<table>

<thead>

<tr>
<th>Section</th>
<th>Male</th>
<th>Female</th>
<th>Total</th>
<th>Last Updated</th>
<th>Action</th>
</tr>

</thead>

<tbody id="tableBody">
</tbody>

</table>

</div>

</div>

<script>

let token =
localStorage.getItem("token");

if(token){
showDashboard();
}

async function login(){

const username =
document.getElementById(
"username"
).value;

const password =
document.getElementById(
"password"
).value;

const res =
await fetch("/login",{

method:"POST",

headers:{
"Content-Type":
"application/json"
},

body:JSON.stringify({
username,
password
})

});

const data =
await res.json();

if(data.token){

localStorage.setItem(
"token",
data.token
);

token = data.token;

showDashboard();

}else{

alert(
"Invalid Login"
);

}

}

function showDashboard(){

document
.getElementById(
"loginCard"
)
.classList.add(
"hidden"
);

document
.getElementById(
"dashboard"
)
.classList.remove(
"hidden"
);

loadSections();

}

async function loadSections(){

const res =
await fetch(
"/sections",
{
headers:{
Authorization:
"Bearer " +
token
}
}
);

const sections =
await res.json();

let totalPopulation = 0;

const keyword =
document
.getElementById(
"search"
)?.value
.toLowerCase() || "";

let html = "";

sections.forEach(s=>{

if(
!s.section_name
.toLowerCase()
.includes(keyword)
){
return;
}

totalPopulation += s.total;

html += \`
<tr>
<td>\${s.section_name}</td>
<td>\${s.male}</td>
<td>\${s.female}</td>
<td>\${s.total}</td>
<td>\${s.updated_at}</td>
<td>
<button onclick="
editSection(
\${s.id},
'\${s.section_name}',
\${s.male},
\${s.female}
)">
Edit
</button>
</td>
</tr>
\`;

});

document.getElementById(
"tableBody"
).innerHTML = html;

document.getElementById(
"population"
).innerText =
totalPopulation;

}

async function addSection(){

const section_name =
document.getElementById(
"section"
).value;

const male =
document.getElementById(
"male"
).value;

const female =
document.getElementById(
"female"
).value;

await fetch(
"/sections",
{

method:"POST",

headers:{
"Content-Type":
"application/json",

Authorization:
"Bearer " +
token
},

body:JSON.stringify({
section_name,
male,
female
})

});

document.getElementById(
"section"
).value = "";

document.getElementById(
"male"
).value = "";

document.getElementById(
"female"
).value = "";

loadSections();

}

async function editSection(
id,
name,
male,
female
){

const section_name =
prompt(
"Section Name",
name
);

const newMale =
prompt(
"Number of Male Students",
male
);

const newFemale =
prompt(
"Number of Female Students",
female
);

if(!section_name) return;

await fetch(
"/sections/" + id,
{

method:"PUT",

headers:{
"Content-Type":
"application/json",

Authorization:
"Bearer " +
token
},

body:JSON.stringify({

section_name,
male:newMale,

female:newFemale

})

});

loadSections();

}

</script>

</body>
</html>
`);

});

app.listen(PORT, () => {
  console.log(
    "Server Running: http://localhost:3000"
  );
});