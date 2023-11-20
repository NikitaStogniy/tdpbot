const { Telegraf } = require("telegraf");
const { Client } = require("pg");
const dotenv = require("dotenv");
dotenv.config();
const bot = new Telegraf(process.env.BOT_TOKEN);
const fs = require("fs");
const { default: cluster } = require("cluster");

const getRepair = {
  1: "Нет",
  2: "Косметический",
  3: "Евроремонт",
  4: "Дизайнерский",
};

const client = new Client({
  connectionString: process.env.PG_DATABASE,
});
client.connect();
client.query(
  `
  CREATE TABLE IF NOT EXISTS property (
    author TEXT,
    author_type TEXT,
    link TEXT,
    city TEXT,
    deal_type TEXT,
    accommodation_type TEXT,
    floor INT,
    floors_count INT,
    rooms_count INT,
    total_meters FLOAT,
    price_per_m2 FLOAT,
    price FLOAT,
    district TEXT,
    street TEXT,
    house_number TEXT,
    underground TEXT,
    residential_complex TEXT,
    repair INT,
    min_house_year INT,
    max_house_year INT,
    metro_foot_minute INT,
    clusternumber TEXT,
    id SERIAL PRIMARY KEY
  );`,
  (err, res) => {
    if (err) {
      console.error(err);
      return;
    }
    console.log("Table is successfully created");
  }
);

bot.start((ctx) => {
  ctx.reply(
    "Привет! Я бот TODAYPRICE, буду переодически присылать тебе неплохие предложения по недвижимости"
  );
  client.query(
    `INSERT INTO users (uid) VALUES ($1) ON CONFLICT (uid) DO NOTHING`,
    [ctx.from.id],
    (err, res) => {
      if (err) {
        console.error(err);
      } else {
        console.log("Пользователь успешно добавлен в базу данных");
      }
    }
  );
});

async function getUsers() {
  const users = await client.query("SELECT * FROM users");
  return users.rows;
}

async function sendMessage(message) {
  const users = await getUsers();
  users.forEach((user) => {
    try {
      bot.telegram.sendMessage(user.uid, message);
    } catch (e) {
      console.log(e);
    }
  });
}

async function getMedianM2(clusternumber) {
  const medianM2 = await client.query(
    `SELECT clusternumber, 
    CASE 
      WHEN COUNT(*) OVER (PARTITION BY clusternumber) > 0 THEN percentile_cont(0.5) WITHIN GROUP (ORDER BY price_per_m2)
      ELSE AVG(price_per_m2) 
    END as median_price_per_m2
    FROM property WHERE clusternumber = $1
    GROUP BY clusternumber`,
    [clusternumber]
  );
  console.log("median", medianM2.rows[0].median_price_per_m2);
  return medianM2.rows[0].median_price_per_m2;
}

async function getPercent(property) {
  const medianCluster = await getMedianM2(property.clusternumber);
  console.log("fromPercent", property);
  return (
    (((await medianCluster) - property.price_per_m2) / (await medianCluster)) *
    100
  );
}

async function getPotential(property) {
  const medianCluster = await getMedianM2(property.clusternumber);
  return (
    medianCluster * property.total_meters +
    45000 * property.total_meters -
    (property.price + 45000 * property.total_meters)
  );
}

async function getProperty(id) {
  const property = await client.query("SELECT * FROM property WHERE id = $1", [
    id,
  ]);
  return property.rows[0];
}

async function getLabel(property) {
  const medianCostWithRepair = await client.query(
    `SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY price + 45000 * total_meters) as median_price_with_repair
          FROM property`
  );
  const repairCost = 45000 * property.total_meters;
  const totalCostWithRepair = property.price + repairCost;
  if (
    totalCostWithRepair <
    medianCostWithRepair.rows[0].median_price_with_repair * 0.9
  ) {
    return "✅ Зеленый (после ремонта можно заработать больше 10%)";
  } else if (
    totalCostWithRepair < medianCostWithRepair.rows[0].median_price_with_repair
  ) {
    return "🟨 Желтый (после ремонта можно заработать меньше 10%)";
  } else {
    return "❌ Красный (не рекомендуется к покупке)";
  }
}

async function generateMessage(property) {
  const percent = await getPercent(property);
  const floor = `Этаж ${property.floor} из ${property.floors_count}`;
  const adress = `${property.city}, ${
    property.district
  }, ${property.street.concat()}, до метро ${
    property.metro_foot_minute
  } минут\n\nРемонт: ${getRepair[property.repair]}`;
  const discontPercent = ` \nОтклонение от медианной стоимости за квадратный метр составляет -${percent.toFixed(
    1
  )}%`;
  const year = `\nГод постройки до ${property.max_house_year}`;
  const potential = `\n\nПотенциал заработка на квартире ${(
    await getPotential(property)
  ).toLocaleString("ru-RU")}₽`;
  const fullPrice = `\n\nПри стоимости ремонта 45 тыс ₽. за кв.м. объект на выходе будет стоить ${(
    property.price +
    45000 * property.total_meters
  ).toLocaleString("ru-RU")}₽`;
  const link = `\n\n${property.link}`;
  const labelmsg = `\n\nЛейбл: ${await getLabel(property)}\n\n`;
  const message = `${adress}\n\n${floor}${year}${discontPercent}${potential}${fullPrice}${link}${labelmsg}`;

  await sendMessage(message);
}

let lastId = 0;
setInterval(async () => {
  const res = await client.query("SELECT MAX(id) FROM property");
  const newId = res.rows[0].max;
  if (newId > lastId) {
    lastId = newId;

    const checkProperty = await getProperty(newId);

    if (
      checkProperty.price_per_m2 <
      (await getMedianM2(checkProperty.clusternumber)) * 0.95
    ) {
      await generateMessage(checkProperty);
    } else {
      console.log(`Нет подходящих предложений`);
      let db;
      try {
        db = { id: JSON.parse(fs.readFileSync("db.json")).id };
      } catch {
        db = { id: [123, 9321] };
      }
      const bestProperty = await client.query(
        `SELECT *
         FROM property
         WHERE id NOT IN (${db.id.join(",")})
         GROUP BY clusternumber, id
         ORDER BY price_per_m2 ASC
         LIMIT 1`
      );
      if (bestProperty.rows.length > 0) {
        db.id.push(bestProperty.rows[0].id);
        fs.writeFileSync("db.json", JSON.stringify(db));
        console.log(bestProperty.rows[0].clusternumber);
        await generateMessage(bestProperty.rows[0]);
      } else {
        console.log("Нет новых предложений 1");
      }
    }
  } else {
    console.log("Нет новых предложений 2");
  }
}, 36000);

bot.launch();
