init()

function init()
{
    const urlParams = new URLSearchParams(window.location.search);
    loadInfo(urlParams.get("numero"));
}

async function loadInfo(contrato)
{
    var lotData;
    await fetch(`https://organizacaodiamante.com/api/read?path=UnidadesVendidas/${contrato}`)
    .then(function(result) {
        return result.json();
    })
    .then(function(result) {
        lotData = result.data;
    }).catch(function(err) {
      console.log('Fetch Error:', err);
    });
    if(lotData != null)
    {

        document.getElementById('card_info_terreno').innerHTML = 
        `
        <div class="card-body">
            <div style="display: block;">
                <h2 style="margin-bottom: 20px;">${lotData.lot_info.name}</h2>
                <img src="${lotData.lot_info.img}" style="width: 100%;">
                                    
                <table class="table table-striped" style="margin-top: 15px;">
                    <tbody>
                    <tr>
                        <td><strong>Situação Atual</strong></td>
                        <td>Disponível</td>
                    </tr>
                    <tr>
                        <td><strong>Tamanho</strong></td>
                        <td>${lotData.lot_info.size}</td>
                    </tr>
                    <tr>
                        <td><strong>Água</strong></td>
                        <td>${booleanToText(lotData.lot_info.infrastructure.water)}</td>
                    </tr>
                    <tr>
                        <td><strong>Energia Elétrica</strong></td>
                        <td>${booleanToText(lotData.lot_info.infrastructure.energy)}</td>
                    </tr>
                    <tr>
                        <td><strong>Internet</strong></td>
                        <td>${booleanToText(lotData.lot_info.infrastructure.internet)}</td>
                    </tr>
                    <tr>
                        <td><strong>Acesso</strong></td>
                        <td>${lotData.lot_info.infrastructure.access}</td>
                    </tr>
                    </tbody>
                </table>
                
            <label class="form-check-label" style="margin-top: 10px;">
                <input type="checkbox" class="form-check-input" id="check_terreno">
                <b>Eu concordo que desejo adquirir esta Unidade Autônoma</b>
            </label>

            </div>
        </div>
        `
        loadTerms()
    }

    const checkTerreno = document.getElementById("check_terreno");
    if (checkTerreno) {
        checkTerreno.addEventListener("change", function() {
            console.log("Checkbox está agora: " + (this.checked ? "Checked" : "Unchecked"));
        });
    } else {
        console.error("Checkbox 'check_terreno' não encontrado!");
    }
}

function booleanToText(input)
{
    if(input)
        return "Sim";
    else
        return "Não"
}

async function loadTerms()
{
    var terms;
    console.log("HOIOASD")
    await fetch(`https://organizacaodiamante.com/api/read?path=Config/TermosGerais_Vendas/condominiotrombadanta`)
    .then(function(result) {
        return result.json();
    })
    .then(function(result) {  
        terms = result.data
    }).catch(function(err) {
      console.log('Fetch Error:', err);
    });

    if(terms != null)
    {
        const cardTerreno = document.getElementById("card_info_terreno");
        const alturaTerreno = cardTerreno ? cardTerreno.offsetHeight + "px" : "500px";
        console.log(alturaTerreno)
        document.getElementById('card_termos').innerHTML =
        `
        <div class="card-body d-flex flex-column" style="flex-grow: 1; height: 100%;">
            <h2 style="margin-bottom: 20px;">Termos de Serviço e Compra</h2>
            <div class="termos-box" style="overflow-y: auto; flex-grow: 1; border: 1px solid #ddd; padding: 10px; background-color: #f9f9f9; max-height: ${alturaTerreno};">
                ${terms}
            </div>
            <label class="form-check-label" style="margin-top: 10px;">
                <input type="checkbox" class="form-check-input" id="check_termos">
                <b>Eu concordo que li e aceito os Termos de Serviço e Compra</b>
            </label>
        </div>
        `
    }
}



//#region EVENT LISTENERS

//#endregion