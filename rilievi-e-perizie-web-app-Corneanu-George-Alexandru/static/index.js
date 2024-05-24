"use strict"

let img = "";
let mappa;

$(document).ready(async function () {

	await caricaGoogleMaps();

	let hamBurger = document.querySelector(".toggle-btn");
	let _divVisualizzaMappa = $("#divVisualizzaMappa");
	let _divDettagliPerizia = $("#divDettagliPerizia");
	let _divVisualizzaUtenti = $("#divVisualizzaUtenti");
	let _divCreaUtente = $("#divCreaUtente");
	let _divPercorsoPerizia = $("#divPercorsoPerizia");
	let mapContainer = $("#map").get(0);
	let filtroPerUtente = $("#filtroPerUtente");

	$("#visualizzaMappa").on("click", () => {
		_divVisualizzaMappa.show();
		_divDettagliPerizia.hide();
		_divPercorsoPerizia.hide();
		_divVisualizzaUtenti.hide();
		_divCreaUtente.hide();
		caricaFiltro();
	});
	$("#visualizzaMappa").trigger("click");

	$("#visualizzaUtenti").on("click", () => {
		_divVisualizzaUtenti.show();
		_divVisualizzaMappa.hide();
		_divDettagliPerizia.hide();
		_divPercorsoPerizia.hide();
		_divCreaUtente.hide();
		getUtenti();
	});

	$("#creaUtente").on("click", () => {
		_divCreaUtente.show();
		_divVisualizzaMappa.hide();
		_divDettagliPerizia.hide();
		_divPercorsoPerizia.hide();
		_divVisualizzaUtenti.hide();
		$("#nome").val("");
		$("#cognome").val("");
		$("#dataNascita").val("");
		$("#luogoNascita").val("");
		$("#genere").find("input:radio").prop("checked", false);
		$("#username").val("");
		$("#immagineProfilo").val("");
		$("#previewImg").prop("src", "").css("display", "none");
	});

	$("#immagineProfilo").on("change", async function () {
		let blob = $(this).prop("files")[0];
		img = await base64Converter(blob);
		let cssOptions = {
			"max-width": "125px",
			"max-height": "125px",
			"margin-top": "15px",
			"display": "inline-block",
			"vertical-align": "middle",
			"margin-right": "160px",
			"border-radius": "50%"
		}
		$("#previewImg").prop("src", img).css(cssOptions);
	});

	$("#btnIndietro").on("click", () => {
		_divDettagliPerizia.show();
		_divPercorsoPerizia.hide();
	});

	function base64Converter(blob) {
		return new Promise((resolve, reject) => {
			let reader = new FileReader;
			reader.readAsDataURL(blob);
			reader.onload = (event) => {
				resolve(event.target.result);
			}
			reader.onerror = (error) => {
				reject(error);
			};
		});
	}

	$("#btnCreaUtente").on("click", () => {
		let nome = $("#nome").val();
		let cognome = $("#cognome").val();
		let dataNascita = $("#dataNascita").val();
		let luogoNascita = $("#luogoNascita").val();
		let genere = $("#genere").find("input:radio:checked").val();
		let username = $("#username").val();
		if (nome != "" && cognome != "" && dataNascita != "" && luogoNascita != "" && genere != null && username != "" && img != "") {
			let newUser = {
				"nome": nome,
				"cognome": cognome,
				"dataNascita": dataNascita,
				"luogoNascita": luogoNascita,
				"genere": genere,
				"username": username,
				"img": img
			}
			let rq = inviaRichiesta("POST", "/api/createUser", newUser);
			rq.catch(errore);
			rq.then((response) => {
				console.log(response.data);
				let username = response.data.username;
				let password = response.data.password;
				let rq = inviaRichiesta("POST", "/api/sendNewPassword", { "username": username, "password": password });
				rq.catch(errore);
				rq.then((response) => {
					Swal.fire({
						"icon": "success",
						"title": "Creazione Utente",
						"text": "Utente creato correttamente"
					});
					$("#nome").val("");
					$("#cognome").val("");
					$("#dataNascita").val("");
					$("#luogoNascita").val("");
					$("#genere").find("input:radio").prop("checked", false);
					$("#username").val("");
					$("#immagineProfilo").val("");
					$("#previewImg").prop("src", "").css("display", "none");
				});
			});
		}
		else {
			Swal.fire({
				"icon": "error",
				"title": "Creazione Utente",
				"text": "Compilare tutti i campi"
			});
		}
	});

	function disegnaMappa() {
		let position = {
			"lat": 44.555417,
			"lng": 7.736524
		}
		let mapOptions = {
			"center": position,
			"zoom": 12,
			"styles": [
				{
					"featureType": "poi",
					"stylers": [{ "visibility": "off" }]
				},
				// {
				// 	"elementType": "labels",
				// 	"stylers": [{ "visibility": "off" }]
				// }
			]
		}
		mappa = new google.maps.Map(mapContainer, mapOptions);
		let markerOptions = {
			"map": mappa,
			"position": position,
			"title": "Sede Operativa",
			"icon": { "url": "img/icons/base.png", "labelOrigin": { "x": 12, "y": 40 } },
			"label": { "color": "red", "fontSize": '9pt', "fontWeight": "bold", "text": "Sede Operativa" }
		}
		let marker = new google.maps.Marker(markerOptions);
		marker.addListener("click", function () {
			let content =
				`<div>
					<img src="img/progetto/vallauri.jpg">
					<br><br>
					<p><b>Istituto Istruzione Superiore "Giancarlo Vallauri"</b></p>
					<p>Località: <b>Fossano</b></p>
				</div>`
			let sweetAlertOptions = {
				"title": "Sede Operativa",
				"html": content
			}
			Swal.fire(sweetAlertOptions);
		});
	}

	function caricaFiltro() {
		let rq = inviaRichiesta("GET", "/api/getUsers");
		rq.catch(errore);
		rq.then((response) => {
			filtroPerUtente.empty();
			$("<option>").prop({ "selected": true, "value": "Tutti" }).text("Tutti").appendTo(filtroPerUtente);
			for (let utente of response.data) {
				$("<option>").prop("value", utente._id).text(utente.username).appendTo(filtroPerUtente);
			}
			filtroPerUtente.on("change", function () {
				caricaMappa($(this).prop("value"));
			});
			filtroPerUtente.trigger("change");
		});
	}

	function caricaMappa(codiceOperatore) {
		let rq = inviaRichiesta("GET", "/api/getPerizie", { "codiceOperatore": codiceOperatore });
		rq.catch(errore);
		rq.then((response) => {
			$("#numPerizieTotali").text(response.data.length);
			disegnaMappa();
			for (let perizia of response.data) {
				let position = {
					"lat": perizia.coordinate.lat,
					"lng": perizia.coordinate.lng
				}
				let markerOptions = {
					"map": mappa,
					"position": position,
					"title": "Perizia",
					"icon": { "url": "img/icons/perizia.png", "labelOrigin": { "x": 12, "y": 40 } },
					"label": { "color": "red", "fontSize": '9pt', "fontWeight": "bold", "text": "Perizia" }
				}
				let marker = new google.maps.Marker(markerOptions);
				marker.addListener("click", function () {
					showDettails(perizia);
				});
			}
		});
	}

	function showDettails(perizia) {
		_divDettagliPerizia.show();
		_divVisualizzaMappa.hide();
		let _divImmaginiDescrizioni = $("#divImmaginiDescrizioni");
		_divImmaginiDescrizioni.empty();
		$("#btnModifica").prop("disabled", true);
		let rq = inviaRichiesta("GET", "/api/getOperatoreById", { "_id": perizia.codiceOperatore });
		rq.catch(errore);
		rq.then(async (response) => {
			$("#operatore").val(response.data.username);
			$("#data").val(new Date(perizia.dataPerizia).toLocaleDateString());
			$("#descrizione").val(perizia.descrizione).on("keyup", () => {
				$("#btnModifica").prop("disabled", false);
			});
			let index = 0;
			$("<h1>").text("Immagini e Commenti Perizia").appendTo(_divImmaginiDescrizioni);
			for (let foto of perizia.foto) {
				let div = $("<div>").addClass("mb-3").appendTo(_divImmaginiDescrizioni);
				$("<img>").prop("src", foto.img).addClass("img-fluid").css("max-width", "250px").prop("id", `img-${index}`).appendTo(div);
				div = $("<div>").addClass("mb-3").appendTo(_divImmaginiDescrizioni);
				$("<input>").prop("type", "text").val(foto.descrizioneFoto).addClass("form-control").prop("id", `descrizione-${index}`).appendTo(div).on("keyup", () => {
					$("#btnModifica").prop("disabled", false);
				});
				index++;
			}
			$("#btnAnnulla").on("click", () => {
				_divDettagliPerizia.hide();
				_divVisualizzaMappa.show();
				_divImmaginiDescrizioni.empty();
			});
			$("#btnModifica").on("click", () => {
				perizia["descrizione"] = $("#descrizione").val();
				console.log($("#descrizione").val());
				for (let i = 0; i < index; i++) {
					perizia["foto"][i]["descrizioneFoto"] = $(`#descrizione-${i}`).val();
				}
				let rq = inviaRichiesta("PATCH", "/api/updatePerizia", perizia);
				rq.catch(errore);
				rq.then((response) => {
					Swal.fire({
						"icon": "success",
						"title": "Modifica Perizia",
						"text": "Perizia modificata correttamente"
					}).then((result) => {
						_divDettagliPerizia.hide();
						_divVisualizzaMappa.show();
						_divImmaginiDescrizioni.empty();
						filtroPerUtente.trigger("change");
					});
				});
			});
			$("#btnPercorso").on("click", () => {
				_divDettagliPerizia.hide();
				_divPercorsoPerizia.show();
				let mapContainerPercorsoPerizia = $("#mappaPercorsoPerizia").get(0);
				let mapPanel = $("#mapPanel").get(0);
				let msg = $("#msg");
				let posPartenza = {
					"lat": 44.555417,
					"lng": 7.736524
				}
				let posArrivo = perizia.coordinate;
				let routeOptions = {
					'origin': posPartenza,
					'destination': posArrivo,
					'travelMode': google.maps.TravelMode.DRIVING,
					'provideRouteAlternatives': false,
					'avoidTolls': false
				}
				let directionsService = new google.maps.DirectionsService();
				let promise = directionsService.route(routeOptions);
				promise.then((result) => {
					if (result.status == google.maps.DirectionsStatus.OK) {
						console.log(result.routes[0]);
						let mapOptions = {};
						let map = new google.maps.Map(mapContainerPercorsoPerizia, mapOptions);
						let rendererOptions = {
							'polylineOptions': {
								'strokeColor': '#44F',
								'strokeWeight': 6,
							}
						}
						let directionsRenderer = new google.maps.DirectionsRenderer(rendererOptions);
						directionsRenderer.setMap(map);
						directionsRenderer.setDirections(result);
						mapPanel.innerHTML = "";
						directionsRenderer.setPanel(mapPanel);
						let distanza = result.routes[0].legs[0].distance.text
						let tempo = result.routes[0].legs[0].duration.text
						msg.html("Distanza: <b>" + distanza + "</b><br> Tempo di percorrenza: <b>" + tempo + "</b>");
					}
				}).catch((err) => {
					console.log(err);
					alert("Errore: " + err.message);
				})
			});
		});
	}

	function getUtenti() {
		let rq = inviaRichiesta("GET", "/api/getUsers");
		rq.catch(errore);
		rq.then((response) => {
			let tbody = $("#divVisualizzaUtenti").find("tbody");
			tbody.empty();
			for (let utente of response.data) {
				let tr = $("<tr>").appendTo(tbody);
				let td = $("<td>").appendTo(tr);
				$("<img>").prop("src", utente.img).addClass("rounded-circle").css("width", "50").appendTo(td);
				$("<td>").text(utente.username).appendTo(tr);
				$("<td>").text(utente.nome).appendTo(tr);
				$("<td>").text(utente.cognome).appendTo(tr);
				$("<td>").text(utente.genere).appendTo(tr);
				$("<td>").text(utente.dataNascita).appendTo(tr);
				$("<td>").text(utente.luogoNascita).appendTo(tr);
				td = $("<td>").appendTo(tr);
				let button = $("<button>").addClass("btn btn-primary btn-sm me-2").appendTo(td).on("click", () => {
					editUser(utente);
				});
				$("<i>").addClass("fas fa-search").appendTo(button);
				button = $("<button>").addClass("btn btn-danger btn-sm").appendTo(td).on("click", () => {
					deleteUser(utente._id);
				});
				$("<i>").addClass("fas fa-trash-alt").appendTo(button);
			}
		});
	}

	function deleteUser(_id) {
		let rq = inviaRichiesta("DELETE", "/api/deleteUser", { "_id": _id });
		rq.catch(errore);
		rq.then((response) => {
			Swal.fire({
				"icon": "success",
				"title": "Cancellazione Utente",
				"text": "Utente cancellato correttamente"
			}).then((result) => {
				getUtenti();
			});
		});
	}

	function editUser(utente) {
		let content = $("<div>");
		$("<label>").html("Nome:&nbsp").appendTo(content);
		$("<input>").prop("type", "text").prop("id", "editNome").attr("value", utente.nome).appendTo(content);
		$("<br>").appendTo(content);
		$("<br>").appendTo(content);
		$("<label>").html("Cognome:&nbsp").appendTo(content);
		$("<input>").prop("type", "text").prop("id", "editCognome").attr("value", utente.cognome).appendTo(content);
		$("<br>").appendTo(content);
		$("<br>").appendTo(content);
		$("<label>").html("Genere:&nbsp").appendTo(content);
		$("<input>").prop("type", "text").prop("id", "editGenere").attr("value", utente.genere).appendTo(content);
		$("<br>").appendTo(content);
		$("<br>").appendTo(content);
		$("<label>").html("Data di nascita:&nbsp").appendTo(content);
		$("<input>").prop("type", "date").prop("id", "editDataNascita").attr("value", utente.dataNascita).appendTo(content);
		$("<br>").appendTo(content);
		$("<br>").appendTo(content);
		$("<label>").html("Luogo di nascita:&nbsp").appendTo(content);
		$("<input>").prop("type", "text").prop("id", "editLuogoNascita").attr("value", utente.luogoNascita).appendTo(content);
		$("<br>").appendTo(content);
		$("<br>").appendTo(content);
		$("<label>").html("Username:&nbsp").appendTo(content);
		$("<input>").prop("type", "text").prop("id", "editUsername").attr("value", utente.username).appendTo(content);
		Swal.fire({
			"icon": "question",
			"title": "Modifica Utente",
			"html": content.html(),
			"allowOutsideClick": false,
			"allowEscapeKey": false,
			"showDenyButton": true
		}).then((result) => {
			if (result.isConfirmed) {
				utente["nome"] = $("#editNome").val();
				utente["cognome"] = $("#editCognome").val();
				utente["genere"] = $("#editGenere").val();
				utente["dataNascita"] = $("#editDataNascita").val();
				utente["luogoNascita"] = $("#editLuogoNascita").val();
				utente["username"] = $("#editUsername").val();
				let rq = inviaRichiesta("PATCH", "/api/updateUser", utente);
				rq.catch(errore);
				rq.then((response) => {
					Swal.fire({
						"icon": "success",
						"title": "Modifica Utente",
						"text": "Utente modificato correttamente"
					}).then((result) => {
						getUtenti();
					});
				});
			}
		});
	}

	$("#btnCambiaPassword").on("click", () => {
		let content = $("<div>");
		$("<label>").html("Username:&nbsp").appendTo(content);
		$("<input>").prop("type", "text").prop("id", "changePwdUsername").appendTo(content);
		$("<br>").appendTo(content);
		$("<br>").appendTo(content);
		$("<label>").html("Nuova Password:&nbsp").appendTo(content);
		$("<input>").prop("type", "password").prop("id", "changePwdPassword").appendTo(content);
		Swal.fire({
			"icon": "question",
			"title": "Cambia Password",
			"html": content.html(),
			"allowOutsideClick": false,
			"allowEscapeKey": false,
			"showDenyButton": true
		}).then((result) => {
			if (result.isConfirmed) {
				if ($("#changePwdUsername").val() != "" && $("#changePwdPassword").val() != "") {
					let aus = {
						"username": $("#changePwdUsername").val(),
						"nuovaPassword": $("#changePwdPassword").val()
					}
					let rq = inviaRichiesta("PATCH", "/api/changePassword", aus);
					rq.catch(errore);
					rq.then((response) => {
						if (response.data == "Username non trovato") {
							Swal.fire({
								"icon": "error",
								"title": "Cambia Password",
								"text": "Username non trovato"
							});
						}
						else {
							Swal.fire({
								"icon": "success",
								"title": "Cambia Password",
								"text": "Password cambiata correttamente"
							}).then((result) => {
								localStorage.removeItem("token");
								window.location.href = "login.html";
							});
						}
					});
				}
				else {
					Swal.fire({
						"icon": "error",
						"title": "Cambia Password",
						"text": "Inserire tutti i dati necessari"
					});
				}
			}
		});
	});

	$("#btnLogout").on("click", () => {
		localStorage.removeItem("token");
		window.location.href = "login.html";
	});

	hamBurger.addEventListener("click", function () {
		document.querySelector("#sidebar").classList.toggle("expand");
	});

});