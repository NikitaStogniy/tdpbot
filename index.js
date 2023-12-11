const dotenv = require("dotenv");
dotenv.config();
const { Telegraf } = require("telegraf");
const { Client } = require("pg");
const bot1 = new Telegraf(process.env.BOT_TOKEN1);
const bot2 = new Telegraf(process.env.BOT_TOKEN2);
const bot3 = new Telegraf(process.env.BOT_TOKEN3);
const axios = require("axios");

const client = new Client({
  host: process.env.HOST,
  port: process.env.PORT,
  user: process.env.USERNAME,
  password: process.env.PASSWORD,
  database: process.env.DATABASE,
});
client.connect();

client.query(
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS stop BOOLEAN DEFAULT false`,
  (err, res) => {
    if (err) {
      console.error(err);
    } else {
      console.log("Столбец 'stop' успешно добавлен в таблицу 'users'");
    }
  }
);

bot1.start(async (ctx) => {
  ctx.reply(
    "Привет! Я бот TODAYPRICE, буду переодически присылать тебе неплохие предложения по недвижимости"
  );

  // Проверка на существование пользователя в базе данных
  const userExists = await client.query(
    `SELECT 1 FROM users WHERE userid = $1`,
    [ctx.from.id]
  );

  // Создание таблицы пользователей, если она не существует
  client.query(
    `CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      userid INTEGER UNIQUE
    )`
  );

  // Если пользователь не существует, добавляем его в базу данных
  if (userExists.rows.length === 0) {
    client.query(
      `INSERT INTO users (userid) VALUES ($1)`,
      [ctx.from.id],
      (err, res) => {
        if (err) {
          console.error(err);
        } else {
          console.log("Пользователь успешно добавлен в базу данных");
        }
      }
    );
  }
});

bot2.start(async (ctx) => {
  ctx.reply(
    "Привет! Я бот TODAYPRICE, буду переодически присылать тебе неплохие предложения по недвижимости"
  );

  // Проверка на существование пользователя в базе данных
  const userExists = await client.query(
    `SELECT 1 FROM users WHERE userid = $1`,
    [ctx.from.id]
  );

  // Если пользователь не существует, добавляем его в базу данных
  if (userExists.rows.length === 0) {
    client.query(
      `INSERT INTO users (userid) VALUES ($1)`,
      [ctx.from.id],
      (err, res) => {
        if (err) {
          console.error(err);
        } else {
          console.log("Пользователь успешно добавлен в базу данных");
        }
      }
    );
  }
});

bot3.start(async (ctx) => {
  ctx.reply(
    "Привет! Я бот TODAYPRICE, буду переодически присылать тебе неплохие предложения по недвижимости"
  );

  // Проверка на существование пользователя в базе данных
  const userExists = await client.query(
    `SELECT 1 FROM users WHERE userid = $1`,
    [ctx.from.id]
  );

  // Если пользователь не существует, добавляем его в базу данных
  if (userExists.rows.length === 0) {
    client.query(
      `INSERT INTO users (userid) VALUES ($1)`,
      [ctx.from.id],
      (err, res) => {
        if (err) {
          console.error(err);
        } else {
          console.log("Пользователь успешно добавлен в базу данных");
        }
      }
    );
  }
});

bot1.command("stop", async (ctx) => {
  await setStop(ctx.from.id);
  ctx.reply("Вы успешно отписались от рассылки");
});
bot2.command("stop", async (ctx) => {
  await setStop(ctx.from.id);
  ctx.reply("Вы успешно отписались от рассылки");
});
bot3.command("stop", async (ctx) => {
  await setStop(ctx.from.id);
  ctx.reply("Вы успешно отписались от рассылки");
});

async function getUsers() {
  try {
    const users = await client.query("SELECT * FROM users WHERE stop = false");
    return users.rows;
  } catch (error) {
    console.error("Ошибка при получении пользователей:", error);
  }
}

async function setStop(userid) {
  try {
    await client.query("UPDATE users SET stop = true WHERE userid = $1", [
      userid,
    ]);
  } catch (error) {
    console.error("Ошибка при обновлении статуса пользователя:", error);
  }
}

async function sendMessage(message, bot) {
  if (message == undefined) {
    return;
  }
  if (message?.label == "red" || message?.label == undefined) {
    return;
  }
  const users = await getUsers();
  const formatMessage = `Лучшее предложение на сегодня: ${message.address}
Время до метро: ${message.footMetro} минут
${message.difference ? `Дисконт: ${message.difference}₽` : ""}
Потенциал заработка: ${message.potential}₽
Лейбл: ${message.label == "green" ? "🟢" : "🟡"}

${message.link}`;
  for (const user of users) {
    try {
      if (bot == 1) {
        await bot1.telegram.sendMessage(user.userid, formatMessage);
      } else if (bot == 2) {
        await bot2.telegram.sendMessage(user.userid, formatMessage);
      } else if (bot == 3) {
        await bot3.telegram.sendMessage(user.userid, formatMessage);
      }
    } catch (e) {
      console.log(e);
    }
  }
}

async function sendBestDeal() {
  console.log("test");
  const data = {
    email: "admin@admin.com",
    password: "string",
  };

  axios
    .post("http://45.141.184.80:3000/api/auth/login", data)
    .then((response) => {
      const token = response.data.access_token;
      axios
        .get("http://45.141.184.80:3000/api/bot/bestproperty", {
          headers: { Authorization: `Bearer ${token}` },
        })
        .then((response) => {
          const bestDeal = response.data;
          sendMessage(bestDeal[0], 1);
          sendMessage(bestDeal[1], 2);
          sendMessage(bestDeal[2], 3);
        })
        .catch((error) => {
          console.error("Ошибка при получении лучшего предложения:", error);
        });
    })
    .catch((error) => {
      console.error("Ошибка при авторизации:", error);
    });
}

async function parseLinks(room, metro, repair, year) {
  const data = {
    email: "admin@admin.com",
    password: "string",
  };

  axios
    .post("http://45.141.184.80:3000/api/auth/login", data)
    .then((response) => {
      const token = response.data.access_token;
      axios
        .post(
          "http://45.141.184.80:3000/api/demand/parse",
          {
            name: "Test",
            url: `https://spb.cian.ru/cat.php?deal_type=sale&engine_version=2&flat_share=2&floornl=1&foot_min=${metro}&is_by_homeowner=1&is_first_floor=0&max_house_year=${
              year + 10
            }&min_house_year=${year}&offer_type=flat&only_foot=2&region=2&repair%5B0%5D=${repair}&room1=${room}`,
            limit: 40,
          },
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        )
        .then((response) => {
          const bestDeal = response.data;
          sendMessage(bestDeal[0], 1);
          sendMessage(bestDeal[1], 2);
          sendMessage(bestDeal[2], 3);
        })
        .catch((error) => {
          console.error("Ошибка при получении лучшего предложения:", error);
        });
    })
    .catch((error) => {
      console.error("Ошибка при авторизации:", error);
    });
}

setInterval(async () => {
  try {
    await sendBestDeal();
  } catch (error) {
    console.log("Ошибка при отправке лучшего предложения:", error);
  }
}, 600000);

async function cycle() {
  while (true) {
    console.log("start");
    await new Promise((resolve) => setTimeout(resolve, 152 * 1000000));
    try {
      for (let room = 1; room <= 3; room++) {
        for (let metro_minute of [15, 25, 36]) {
          for (let repair_type = 1; repair_type <= 4; repair_type++) {
            for (let min_house_year of [
              1944, 1954, 1964, 1974, 1984, 1994, 2004,
            ]) {
              await new Promise((resolve) => setTimeout(resolve, 600000));
              parseLinks(room, metro_minute, repair_type, min_house_year);
            }
          }
        }
      }
    } catch (error) {
      console.log("Ошибка при отправке лучшего предложения:", error);
    }
  }
}

cycle();

bot1.launch();
bot2.launch();
bot3.launch();
