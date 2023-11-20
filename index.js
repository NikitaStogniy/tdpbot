const { Telegraf } = require("telegraf");
const { Client } = require("pg");
const dotenv = require("dotenv");
dotenv.config();
const bot = new Telegraf(process.env.BOT_TOKEN);

const fs = require("fs");
const { parse } = require("csv-parse");

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
/*
const updateTable = () => {
  fs.createReadStream("db.csv")
    .pipe(parse({ delimiter: ";", relax_column_count: true }))
    .on("data", (row) => {
      if (row.length !== 21) {
        console.error(`Invalid row length: ${row.length}. Expected 21.`);
        return;
      }
      client.query(
        `INSERT INTO property (
        author,
        author_type,
        link,
        city,
        deal_type,
        accommodation_type,
        floor,
        floors_count,
        rooms_count,
        total_meters,
        price_per_m2,
        price,
        district,
        street,
        house_number,
        underground,
        residential_complex,
        repair,
        min_house_year,
        max_house_year,
        metro_foot_minute
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)`,
        row,
        (err, res) => {
          if (err) {
            console.error(err);
            return;
          }
          console.log("Data is successfully inserted");
        }
      );
    });
};

const clustering = () => {
  // Кластеризация данных
  return new Promise((resolve, reject) => {
    client.query(
      `SELECT *,
        CASE
          WHEN metro_foot_minute <= 15 THEN 1
          WHEN metro_foot_minute > 15 AND metro_foot_minute <= 25 THEN 2
          ELSE 3
        END AS metro_category,
        CASE
          WHEN max_house_year > 1924 AND max_house_year <= 1934 THEN 2
          WHEN max_house_year > 1934 AND max_house_year <= 1944 THEN 3
          WHEN max_house_year > 1944 AND max_house_year <= 1954 THEN 4
          WHEN max_house_year > 1954 AND max_house_year <= 1964 THEN 5
          WHEN max_house_year > 1964 AND max_house_year <= 1974 THEN 6
          WHEN max_house_year > 1974 AND max_house_year <= 1984 THEN 7
          WHEN max_house_year > 1984 AND max_house_year <= 1994 THEN 8
          WHEN max_house_year > 1994 AND max_house_year <= 2004 THEN 9
          WHEN max_house_year > 2004 AND max_house_year <= 2014 THEN 10
          ELSE 1
        END AS year_category,
        rooms_count AS rooms_category,
        CASE
          WHEN floor = 1 THEN 2
          WHEN floor = floors_count THEN 3
          ELSE 1
        END AS floor_category,
        repair AS repair_category
      FROM property`,
      (err, res) => {
        if (err) {
          console.error(err);
          reject(err);
        } else {
          // Создание уникального идентификатора кластера
          const clusters = res.rows.map((row) => ({
            ...row,
            cluster_id: `${row.metro_category}-${row.year_category}-${row.rooms_category}-${row.floor_category}-${row.repair_category}`,
          }));
          console.log("Кластеры успешно созданы");
          // Обновление каждой строки своим номером кластера
          clusters.forEach((cluster) => {
            client.query(
              `UPDATE property SET clusternumber = $1 WHERE id = $2`,
              [cluster.cluster_id, cluster.id],
              (err, res) => {
                if (err) {
                  console.error(err);
                } else {
                  console.log(
                    "Строка успешно обновлена своим номером кластера"
                  );
                }
              }
            );
          });
          resolve(clusters);
        }
      }
    );
  });
};
*/

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

const getRepair = {
  1: "Нет",
  2: "Косметический",
  3: "Евроремонт",
  4: "Дизайнерский",
};

let lastId = 0;
setInterval(async () => {
  const res = await client.query("SELECT MAX(id) FROM property");
  const newId = res.rows[0].id;
  if (newId > lastId) {
    lastId = newId;
    const users = await client.query("SELECT * FROM users");

    const medianClusterCost = await client.query(
      `SELECT clusternumber, percentile_cont(0.5) WITHIN GROUP (ORDER BY price_per_m2) as median_price_per_m2
      FROM property
      GROUP BY clusternumber`
    );

    //check if last id cost is lower than median cost
    const lastProperty = await client.query(
      "SELECT clusternumber, price_per_m2 FROM property WHERE id = $1",
      [newId]
    );

    const medianCost = medianClusterCost.rows.find(
      (cluster) => cluster.clusternumber === lastProperty.rows[0].clusternumber
    );

    if (
      lastProperty.rows[0].price_per_m2 <
      medianCost.median_price_per_m2 * 0.95
    ) {
      const newProperty = await client.query(
        "SELECT clusternumber, MIN(price_per_m2) as min_price_per_m2, link, city, district, street, metro_foot_minute, repair, price, total_meters, price_per_m2, max_house_year, floor, floors_count FROM property WHERE id = $1 GROUP BY clusternumber, link, city, district, street, metro_foot_minute, repair, price, total_meters, price_per_m2, max_house_year, floor, floors_count",
        [newId]
      );
      const percent =
        ((medianCost.median_price_per_m2 - lastProperty.rows[0].price_per_m2) /
          medianCost.median_price_per_m2) *
        100;
      newProperty.rows[0].min_price_per_m2 *
        0.05 *
        newProperty.rows[0].total_meters;
      let message = `${newProperty.rows[0].city}, ${
        newProperty.rows[0].district
      }, ${newProperty.rows[0].street}, до метро: ${
        newProperty.rows[0].metro_foot_minute
      }\n Ремонт:${getRepair[newProperty.rows[0].repair]}
            \n Этаж ${newProperty.rows[0].floor} из ${
        newProperty.rows[0].floors_count
      }
            \n Год постройки до ${newProperty.rows[0].max_house_year}
            \nОтклонение от медианной стоимости за квадратный метр составляет -${percent.toFixed(
              1
            )}%\n\nПотенциал заработка на квартире ${
        medianCost.median_price_per_m2 * newProperty.rows[0].total_meters +
        45000 * newProperty.rows[0].total_meters -
        (newProperty.rows[0].price + 45000 * newProperty.rows[0].total_meters)
      }₽\nПри стоимости ремонта 45тыс. за кв.м. объект на выходе будет стоить ${
        newProperty.rows[0].price + 45000 * newProperty.rows[0].total_meters
      }₽ \n${newProperty.rows[0].link}`;
      const medianCostWithRepair = await client.query(
        `SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY price + 45000 * total_meters) as median_price_with_repair
          FROM property`
      );
      const repairCost = 45000 * newProperty.rows[0].total_meters;
      const totalCostWithRepair = newProperty.rows[0].price + repairCost;
      let label = "";
      if (
        totalCostWithRepair <
        medianCostWithRepair.rows[0].median_price_with_repair * 0.9
      ) {
        label = "Зеленый";
      } else if (
        totalCostWithRepair <
        medianCostWithRepair.rows[0].median_price_with_repair
      ) {
        label = "Желтый";
      } else {
        label = "Красный (не рекомендуется к покупке)";
      }
      message += `\n\nЛейбл: ${label}\n\n`;
      users.rows.forEach((user) => {
        bot.telegram.sendMessage(user.uid, message);
      });
    } else {
      console.log("Нет подходящих предложений");
    }
  } else {
    console.log("Нет новых предложений");
  }
}, 6000);

bot.help(async (ctx) => {
  const res = await client.query(
    "SELECT id FROM property ORDER BY RANDOM() LIMIT 1"
  );
  const newId = res.rows[0].id;
  const users = ctx.from.id;

  const medianClusterCost = await client.query(
    `SELECT clusternumber, percentile_cont(0.5) WITHIN GROUP (ORDER BY price_per_m2) as median_price_per_m2
      FROM property
      GROUP BY clusternumber`
  );

  //check if last id cost is lower than median cost
  const lastProperty = await client.query(
    "SELECT clusternumber, price_per_m2 FROM property WHERE id = $1",
    [newId]
  );

  const medianCost = medianClusterCost.rows.find(
    (cluster) => cluster.clusternumber === lastProperty.rows[0].clusternumber
  );

  if (
    lastProperty.rows[0].price_per_m2 <
    medianCost.median_price_per_m2 * 0.95
  ) {
    const newProperty = await client.query(
      "SELECT clusternumber, MIN(price_per_m2) as min_price_per_m2, link, city, district, street, metro_foot_minute, repair, price, total_meters, price_per_m2, max_house_year, floor, floors_count FROM property WHERE id = $1 GROUP BY clusternumber, link, city, district, street, metro_foot_minute, repair, price, total_meters, price_per_m2, max_house_year, floor, floors_count",
      [newId]
    );
    const percent =
      ((medianCost.median_price_per_m2 - lastProperty.rows[0].price_per_m2) /
        medianCost.median_price_per_m2) *
      100;
    newProperty.rows[0].min_price_per_m2 *
      0.05 *
      newProperty.rows[0].total_meters;
    let message = `${newProperty.rows[0].city}, ${
      newProperty.rows[0].district
    }, ${newProperty.rows[0].street}, до метро: ${
      newProperty.rows[0].metro_foot_minute
    }\n Ремонт:${getRepair[newProperty.rows[0].repair]}
          \n Этаж ${newProperty.rows[0].floor} из ${
      newProperty.rows[0].floors_count
    }
          \n Год постройки до ${newProperty.rows[0].max_house_year}
          \nОтклонение от медианной стоимости за квадратный метр составляет -${percent.toFixed(
            1
          )}%\n\nПотенциал заработка на квартире ${
      medianCost.median_price_per_m2 * newProperty.rows[0].total_meters +
      45000 * newProperty.rows[0].total_meters -
      (newProperty.rows[0].price + 45000 * newProperty.rows[0].total_meters)
    }₽\nПри стоимости ремонта 45тыс. за кв.м. объект на выходе будет стоить ${
      newProperty.rows[0].price + 45000 * newProperty.rows[0].total_meters
    }₽ \n${newProperty.rows[0].link}`;
    const medianCostWithRepair = await client.query(
      `SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY price + 45000 * total_meters) as median_price_with_repair
        FROM property`
    );
    const repairCost = 45000 * newProperty.rows[0].total_meters;
    const totalCostWithRepair = newProperty.rows[0].price + repairCost;
    let label = "";
    if (
      totalCostWithRepair <
      medianCostWithRepair.rows[0].median_price_with_repair * 0.9
    ) {
      label = "Зеленый";
    } else if (
      totalCostWithRepair <
      medianCostWithRepair.rows[0].median_price_with_repair
    ) {
      label = "Желтый";
    } else {
      label = "Красный (не рекомендуется к покупке)";
    }
    message += `\n\nЛейбл: ${label}\n\n`;
    bot.telegram.sendMessage(users, message);
  } else {
    bot.telegram.sendMessage(users, "Нет новых предложений");
  }
});

bot.launch();
