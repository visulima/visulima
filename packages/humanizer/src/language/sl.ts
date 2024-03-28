import createDurationLanguage from "./util/create-duration-language";

export const durationLanguage = createDurationLanguage(
    (c) => {
        if (c % 10 === 1) {
            return "leto";
        } if (c % 100 === 2) {
            return "leti";
        } if (c % 100 === 3 || c % 100 === 4 || (Math.floor(c) !== c && c % 100 <= 5)) {
            return "leta";
        } 
            return "let";
        
    },
    (c) => {
        if (c % 10 === 1) {
            return "mesec";
        } if (c % 100 === 2 || (Math.floor(c) !== c && c % 100 <= 5)) {
            return "meseca";
        } if (c % 10 === 3 || c % 10 === 4) {
            return "mesece";
        } 
            return "mesecev";
        
    },
    (c) => {
        if (c % 10 === 1) {
            return "teden";
        } if (c % 10 === 2 || (Math.floor(c) !== c && c % 100 <= 4)) {
            return "tedna";
        } if (c % 10 === 3 || c % 10 === 4) {
            return "tedne";
        } 
            return "tednov";
        
    },
    (c) => (c % 100 === 1 ? "dan" : "dni"),
    (c) => {
        if (c % 10 === 1) {
            return "ura";
        } if (c % 100 === 2) {
            return "uri";
        } if (c % 10 === 3 || c % 10 === 4 || Math.floor(c) !== c) {
            return "ure";
        } 
            return "ur";
        
    },
    (c) => {
        if (c % 10 === 1) {
            return "minuta";
        } if (c % 10 === 2) {
            return "minuti";
        } if (c % 10 === 3 || c % 10 === 4 || (Math.floor(c) !== c && c % 100 <= 4)) {
            return "minute";
        } 
            return "minut";
        
    },
    (c) => {
        if (c % 10 === 1) {
            return "sekunda";
        } if (c % 100 === 2) {
            return "sekundi";
        } if (c % 100 === 3 || c % 100 === 4 || Math.floor(c) !== c) {
            return "sekunde";
        } 
            return "sekund";
        
    },
    (c) => {
        if (c % 10 === 1) {
            return "milisekunda";
        } if (c % 100 === 2) {
            return "milisekundi";
        } if (c % 100 === 3 || c % 100 === 4 || Math.floor(c) !== c) {
            return "milisekunde";
        } 
            return "milisekund";
        
    },
    "čez %s",
    "pred %s",
    ",",
);
