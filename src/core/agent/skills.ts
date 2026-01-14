// core/agent/skills.ts
import fs from "fs";
import path from "path";

interface SkillAction {
  method: "GET" | "POST";
  endpoint: string;
  headers?: Record<string, string>;
  bodyTemplate?: any;
  resultPath?: string;
}

interface Skill {
  name: string;
  description: string;
  baseUrl: string;
  auth?: { type: "bearer" | "query"; envVar: string; paramName?: string };
  actions: Record<string, SkillAction>;
}

export class SkillManager {
  private skills = new Map<string, Skill>();
  private readonly dir = "./skills";

  constructor() {
    this.load();
  }

  private load(): void {
    if (!fs.existsSync(this.dir)) {
      fs.mkdirSync(this.dir, { recursive: true });
      return;
    }

    const files = fs
      .readdirSync(this.dir)
      .filter((f) => f.endsWith(".skill.json"));

    for (const file of files) {
      try {
        const data = fs.readFileSync(path.join(this.dir, file), "utf-8");
        const skill = JSON.parse(data) as Skill;
        this.skills.set(skill.name, skill);
        console.log(`✅ Skill loaded: ${skill.name}`);
      } catch (e) {
        console.error(`❌ Failed to load ${file}:`, e);
      }
    }
  }

  async run(
    skillName: string,
    actionName: string,
    params?: Record<string, string>,
  ): Promise<any> {
    const skill = this.skills.get(skillName);
    if (!skill) throw new Error(`Skill not found: ${skillName}`);

    const action = skill.actions[actionName];
    if (!action)
      throw new Error(`Action not found: ${skillName}.${actionName}`);

    let url = skill.baseUrl + action.endpoint;

    // Подставляем параметры в URL
    if (params) {
      for (const [key, val] of Object.entries(params)) {
        url = url.replace(`{${key}}`, encodeURIComponent(val));
      }
    }

    // Заголовки
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...action.headers,
    };

    // Авторизация
    if (skill.auth) {
      const token = process.env[skill.auth.envVar];
      if (token) {
        if (skill.auth.type === "bearer") {
          headers["Authorization"] = `Bearer ${token}`;
        } else if (skill.auth.type === "query") {
          const sep = url.includes("?") ? "&" : "?";
          url += `${sep}${skill.auth.paramName || "key"}=${token}`;
        }
      }
    }

    // Запрос
    const response = await fetch(url, {
      method: action.method,
      headers,
      body: action.bodyTemplate
        ? JSON.stringify(action.bodyTemplate)
        : undefined,
    });

    if (!response.ok) {
      throw new Error(`Skill error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    // Извлекаем результат по пути
    if (action.resultPath) {
      return action.resultPath
        .split(".")
        .reduce((obj, key) => obj?.[key], data);
    }

    return data;
  }

  list(): string[] {
    return Array.from(this.skills.keys());
  }

  save(skill: Skill): void {
    fs.writeFileSync(
      path.join(this.dir, `${skill.name}.skill.json`),
      JSON.stringify(skill, null, 2),
    );
    this.skills.set(skill.name, skill);
  }
}
