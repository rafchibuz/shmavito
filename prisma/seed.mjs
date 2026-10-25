import { PrismaClient } from "@prisma/client";
import nextEnv from "@next/env";

nextEnv.loadEnvConfig(process.cwd());

const prisma = new PrismaClient();

const categories = [
  { name: "Автомобили", slug: "cars", position: 10 },
  { name: "Другая техника", slug: "other-vehicles", position: 20 },
  { name: "Недвижимость", slug: "real-estate", position: 30 },
  { name: "Запчасти", slug: "parts", position: 40 },
  { name: "Разное", slug: "misc", position: 50 },
];

async function main() {
  for (const category of categories) {
    await prisma.category.upsert({
      where: { slug: category.slug },
      update: { name: category.name, position: category.position, isVisible: true, deletedAt: null },
      create: category,
    });
  }
  await prisma.setting.upsert({
    where: { key: "submissions.activeLimit" },
    update: {},
    create: { key: "submissions.activeLimit", value: 3 },
  });
  await prisma.setting.upsert({
    where: { key: "site.socialLinks" },
    update: {},
    create: {
      key: "site.socialLinks",
      value: [
        { id: "telegram", label: "Telegram STEEL", url: "https://t.me/steelstaya", icon: "telegram" },
        { id: "twitch", label: "Twitch STEEL", url: "https://www.twitch.tv/steel", icon: "twitch" },
        { id: "youtube", label: "YouTube STEEL", url: "https://www.youtube.com/channel/UC-o_cRtKA9IIkYBpceKU8ZA", icon: "youtube" },
      ],
    },
  });
  console.log("Seeded Shmavito categories and defaults.");
}

main()
  .finally(async () => prisma.$disconnect())
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
