document.querySelector("body").addEventListener("click", (e)=>{
    console.log(e.target);
})
document.querySelector("#uploadbtn").addEventListener("click",()=>{
    document.querySelector(".navbar").style.zIndex = "-1";
    console.log("kuch bhi");
});

document.querySelector("#selectbtn").addEventListener("click", ()=>{
    document.querySelector(".navbar").style.zIndex="9999";
});

document.querySelector(".btn-close").addEventListener("click", ()=>{
    document.querySelector(".navbar").style.zIndex="9999";
});
