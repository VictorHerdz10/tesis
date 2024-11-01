const parcearDate=(date)=> {
    const dia = String(date.getDate()).padStart(2, '0');
    const mes = date.getMonth() + 1; // Asumimos que enero es 1 y diciembre es 12
    const ano = date.getFullYear() % 100;
    return `${dia}/${mes}/${ano}`;
  }
  
  const parcearDate2=(date)=> {
    const dia = String(date.getDate()).padStart(2, '0');
    const mes = date.getMonth() + 1; // Asumimos que enero es 1 y diciembre es 12
    const ano = date.getFullYear() % 100;
    return `${dia}-${mes}-${ano}`;
  }
  export{parcearDate2};
  export default parcearDate;