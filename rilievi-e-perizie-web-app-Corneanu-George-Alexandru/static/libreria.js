"use strict";

const MAPS_URL = "https://maps.googleapis.com/maps/api"
const _URL = ""
// Se vuota viene assegnata in automatico l'origine da cui è stata scaricata la pagina

// Configurazione degli interceptors di axios
axios.interceptors.request.use((config) => {
	let token = localStorage.getItem("token");
	if (token) {
		console.log(`Token sent: ${token}`);
		config.headers["authorization"] = token;
	}
	return config;
});

axios.interceptors.response.use((response) => {
	let token = response.headers["authorization"];
	console.log(`Token received: ${token}`);
	localStorage.setItem("token", token);
	return response;
});

function caricaGoogleMaps() {
	let promise = new Promise(function (resolve, reject) {
		var script = document.createElement('script');
		script.type = 'text/javascript';
		script.src = MAPS_URL + '/js?v=3&key=' + MAP_KEY;
		document.body.appendChild(script);
		script.onload = resolve;  // onload non inietta alcun dato
		script.onerror = function () {
			reject("Errore caricamento GoogleMaps")
		}
	})
	return promise
}

function inviaRichiesta(method, url, parameters = {}) {
	let config = {
		"baseURL": _URL,
		"url": url,
		"method": method.toUpperCase(),
		"headers": {
			"Accept": "application/json",
		},
		"timeout": 15000,
		"responseType": "json",
	}

	if (parameters instanceof FormData) {
		config.headers["Content-Type"] = 'multipart/form-data;'
		config["data"] = parameters     // Accept FormData, File, Blob
	}
	else if (method.toUpperCase() == "GET") {
		config.headers["Content-Type"] = 'application/x-www-form-urlencoded;charset=utf-8'
		config["params"] = parameters
	}
	else {
		config.headers["Content-Type"] = 'application/json; charset=utf-8'
		config["data"] = parameters
	}
	return axios(config)
}

function errore(err) {
	if (!err.response)
		alert("Connection Refused or Server timeout");
	else if (err.response.status == 200)
		alert("Formato dei dati non corretto : " + err.response.data);
	else if (err.response.status == 403) {
		alert("Sessione scaduta");
		window.location.href = "login.html"
	}
	else {
		alert("Server Error: " + err.response.status + " - " + err.response.data);
	}
}