// Prints the cleaned IEEE references so their formatting can be checked without building the report.
const fs = require("fs");
const src = fs.readFileSync(__dirname + "/build.js", "utf8");
eval(src.slice(src.indexOf("function clean"), src.indexOf("function loadBib")));
const BS = String.fromCharCode(92);
const bbl = fs.readFileSync(__dirname + "/../../../docs/paper/main.bbl", "utf8");
for (const p of bbl.split(BS + "bibitem{").slice(1)) {
  const body = p.slice(p.indexOf("}") + 1).split(BS + "end{thebibliography}")[0];
  console.log(clean(body));
}
