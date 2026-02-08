
import http from "k6/http";
import { check } from "k6";

export let options = {
  vus: 100, // 100 Virtual Users
  duration: "30s",
};

export default function () {
  http.get("http://localhost:80", {
    headers: { "Host": "rich-round-computer.localhost" },
  });
}

