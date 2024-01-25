function answer(Author, question) {
    var options = {
    mode: 'text',
    args: [Author, question]
    };

    PythonShell.run('test.py', options).then(messages=>{    
        console.log('' + message);
    });}