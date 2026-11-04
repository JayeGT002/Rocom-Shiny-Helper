(async () => {
  const response = await fetch("../data/releases.json");
  if (!response.ok) throw new Error(`读取更新日志失败：HTTP ${response.status}`);
  const releases = await response.json();
  if (!Array.isArray(releases)) throw new Error("更新日志数据必须是数组");

  const list = document.getElementById("changelog-list");
  const fragment = document.createDocumentFragment();
  for (const release of releases) {
    if (typeof release.version !== "string" || typeof release.date !== "string" ||
        typeof release.title !== "string" || !Array.isArray(release.notes)) {
      throw new Error("更新日志条目格式错误");
    }

    const item = document.createElement("li");
    const version = document.createElement("span");
    version.className = "ver";
    version.textContent = `v${release.version}`;
    const date = document.createElement("span");
    date.className = "date";
    date.textContent = release.date;
    const notes = document.createElement("ul");
    for (const note of release.notes) {
      if (typeof note !== "string") throw new Error("更新日志内容必须是文字");
      const noteItem = document.createElement("li");
      noteItem.textContent = note;
      notes.append(noteItem);
    }

    item.append(version, document.createTextNode(release.title), date, notes);
    fragment.append(item);
  }
  list.prepend(fragment);
})();
