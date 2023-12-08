const dotenv = require("dotenv");
dotenv.config();
const { Telegraf } = require("telegraf");
const { Client } = require("pg");
const bot1 = new Telegraf(process.env.BOT_TOKEN1);
const bot2 = new Telegraf(process.env.BOT_TOKEN2);
const bot3 = new Telegraf(process.env.BOT_TOKEN3);
const axios = require("axios");

const client = new Client({
  connectionString: process.env.PG_DATABASE,
});
client.connect();

bot1.start(async (ctx) => {
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
  const data = {
    email: "admin@admin.com",
    password: "string",
  };

  axios
    .post("http://localhost:3000/api/auth/login", data)
    .then((response) => {
      const token = response.data.access_token;
      axios
        .get("http://localhost:3000/api/bot/bestproperty", {
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
setInterval(async () => {
  try {
    await sendBestDeal();
  } catch (error) {
    console.error("Ошибка при отправке лучшего предложения:", error);
  }
}, 1800000);

bot1.launch();
bot2.launch();
bot3.launch();
