"use strict"

$(document).ready(function () {

	let _username = $("#usr");
	let _password = $("#pwd");
	let _lblErrore = $("#lblErrore");

	_lblErrore.hide();

	$("#btnLogin").on("click", controllaLogin);

	$("#btnRecuperaPassword").on("click", function () {
		Swal.fire({
			"icon": "question",
			"title": "Password dimenticata",
			"input": "text",
			"inputLabel": "Inserisci la tua username",
			"showConfirmButton": true,
			"confirmButtonText": "Invia"
		}).then((result) => {
			if (result.isConfirmed) {
				if (result.value != "") {
					let rq = inviaRichiesta("POST", "/api/sendNewPassword", { "username": result.value, "skipCheckToken": true });
					rq.catch(errore);
					rq.then((response) => {
						if (response.data == "Username non trovato") {
							Swal.fire({
								"icon": "error",
								"title": "Password dimenticata",
								"text": "Username non trovato"
							});
						}
						else {
							Swal.fire({
								"icon": "success",
								"title": "Password dimenticata",
								"text": "Mail contenente la nuova password inviata alla propria casella di posta elettronica"
							});
						}
					});
				}
				else {
					Swal.fire({
						"icon": "error",
						"title": "Password dimenticata",
						"text": "Inserire la propria username"
					});
				}
			}
		});
	});

	$(document).on('keydown', function (event) {
		if (event.keyCode == 13)
			controllaLogin();
	});

	function controllaLogin() {
		_username.removeClass("is-invalid");
		_username.prev().removeClass("icona-rossa");
		_password.removeClass("is-invalid");
		_password.prev().removeClass("icona-rossa");

		_lblErrore.hide();

		if (_username.val() == "") {
			_username.addClass("is-invalid");
			_username.prev().addClass("icona-rossa");
		}
		else if (_password.val() == "") {
			_password.addClass("is-invalid");
			_password.prev().addClass("icona-rossa");
		}
		else {
			let rq = inviaRichiesta('POST', '/api/login',
				{
					"username": _username.val(),
					"password": _password.val(),
					"isAdminAccess": true,
					"skipCheckToken": true
				}
			);
			rq.catch(function (err) {
				if (err.response.status == 401) {
					_lblErrore.show();
					console.log(err.response.data);
				}
				else {
					errore(err);
				}
			});
			rq.then((response) => {
				window.location.href = "index.html";
			});
		}
	}

	_lblErrore.children("button").on("click", function () {
		_lblErrore.hide();
	});

});