let {PythonShell} = require('python-shell')
function answer(Author, question) {
    var options = {
    mode: 'text',
    args: [Author, question]
    };

    PythonShell.run('./AI/test.py', options).then(messages=>{    
        console.log('' + message);
    });}
module.exports = { answer };