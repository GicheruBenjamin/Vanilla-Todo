//Component.js
const headings = ["h1","h2","h3","h4","h5","h6"]
const text = ["p", "span"]
const containers = ["header", "main", "section","div", "form"]
const inputs = ["text", "password", "number"]
const buttons = ["button", "submit", "reset"]
const links = ["a"]

const events = ["click", "change", "submit", "focus", "blur"]


function Component(el , props = {}){
    // Type of el check
    if(el !== typeof String){
        console.log("Element is not a string!!")
    }
    const element = document.createElement(el)
    //Type of props
    if(props !== typeof Object){
        console.log("Props must be an onject")
    }
    // Props 1. classname add to element
    element.addClass
    //Props 2. style = {}
    for(sty in props.styles){

    }
    //Props 3. attributes
    for( attr in props.attributes){

    }
    //Props 4. textContent
    element.textContent = props.textContent
    //Props 5.children
    for (child in props.children){

    }
    //Props 6. events
    for (ev in props.events){

    }

    return element

}

function setState(state={},component ,prop){
    //Set state in the component prop provided 
}

function removeComponent(component){

}