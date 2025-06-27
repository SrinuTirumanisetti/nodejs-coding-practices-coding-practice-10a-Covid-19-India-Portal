const express = require("express");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const path = require("path");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const app = express();
app.use(express.json());

const dbPath = path.join(__dirname, "covid19IndiaPortal.db");
let db = null;

const InitializeDbAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log(`Server is running on http://localhost:3000`);
    });
  } catch (e) {
    console.log(`DB Error: ${e.message}`);
    process.exit(1);
  }
};

InitializeDbAndServer();

const authenticateToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];

  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }

  if (jwtToken !== undefined) {
    jwt.verify(jwtToken, "srinutiru", async (error, payload) => {
      if (error) {
        response.status(401).send("Invalid JWT Token");
      } else {
        request.username = payload.username;
        next();
      }
    });
  } else {
    response.status(401).send("Invalid JWT Token");
  }
};

// API 1
app.post("/login", async (request, response) => {
  const { username, password } = request.body;
  const selectUserQuery = `SELECT * FROM user WHERE username = ?;`;
  const dbUser = await db.get(selectUserQuery, [username]);

  if (dbUser === undefined) {
    response.status(400).send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatched) {
      const payload = { username: username };
      const jwtToken = jwt.sign(payload, "srinutiru");
      response.send({ jwtToken });
    } else {
      response.status(400).send("Invalid password");
    }
  }
});

//API 2
app.get("/states", authenticateToken, async (request, response) => {
  const getStatesQuery = `select state_id as stateId,state_name as stateName,population from state order by state_id;`;
  const dbStates = await db.all(getStatesQuery);
  response.send(dbStates);
});

//API 3
app.get("/states/:stateId/", authenticateToken, async (request, response) => {
  const { stateId } = request.params;
  const getStateQuery = `select state_id as stateId,state_name as stateName,population from state where state_id=?;`;
  const dbState = await db.get(getStateQuery, [stateId]);
  response.send(dbState);
});

//API 4

app.post("/districts/", authenticateToken, async (request, response) => {
  const { districtName, stateId, cases, cured, active, deaths } = request.body;
  const addDistrictQuery = `insert into district(district_name,state_id,cases,cured,active,deaths)
         values(?,?,?,?,?,?);`;
  await db.run(addDistrictQuery, [
    districtName,
    stateId,
    cases,
    cured,
    active,
    deaths,
  ]);
  response.send("District Successfully Added");
});

//API 5

app.get(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const getDistrictQuery = `select district_id as districtId,district_name as districtName,state_id as stateId,cases, cured, active, deaths
    from district where district_id = ?;`;
    const dbDistrict = await db.get(getDistrictQuery, [districtId]);
    response.send(dbDistrict);
  }
);

//API 6

app.delete(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const deleteDistrictQuery = `delete from district where district_id=?;`;
    await db.run(deleteDistrictQuery, [districtId]);
    response.send("District Removed");
  }
);

//API 7

app.put(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = request.body;
    const { districtId } = request.params;
    const updateDistrictQuery = `update district 
   set
   district_name =?,
   state_id=?,
   cases=?,
   cured=?,
   active=?,
   deaths=?
   where district_id=?`;
    await db.run(updateDistrictQuery, [
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
      districtId,
    ]);
    response.send("District Details Updated");
  }
);

//API 8

app.get(
  "/states/:stateId/stats/",
  authenticateToken,
  async (request, response) => {
    const { stateId } = request.params;
    const getStatQuery = `select sum(cases) AS totalCases,sum(cured) AS totalCured,sum(active) as totalActive,sum(deaths) as totalDeaths from district where state_id=?;`;
    const dbStat = await db.get(getStatQuery, [stateId]);
    response.send(dbStat);
  }
);

module.exports = app;
