document.getElementById("adminForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.getElementById("email").value;
  const file = document.getElementById("pdf").files[0];

  const formData = new FormData();
  formData.append("email", email);
  formData.append("pdf", file);

  const res = await fetch("/send-pdf", {
    method: "POST",
    body: formData,
  });

  const data = await res.json();
  alert(data.message || "Erreur");
});
