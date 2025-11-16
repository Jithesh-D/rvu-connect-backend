import bcrypt from "bcrypt";
const hashed = await bcrypt.hash("put pass", 10);
console.log(hashed);
