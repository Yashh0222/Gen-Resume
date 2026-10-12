import axios from "axios";

const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || "http://localhost:3000",
    withCredentials:true
})

api.interceptors.request.use((config) => {
    const token = localStorage.getItem("token")
    if (token) {
        config.headers.Authorization = `Bearer ${token}`
    }
    return config
})



export async function register({ username, email, password }) {
    try {
        const response = await api.post("/api/auth/register", {
            username,
            email,
            password
        })
        if (response.data.token) {
            localStorage.setItem("token", response.data.token)
        }
        return response.data

    } catch (err) {
        console.log(err)
        return err.response.data
    }
}

export async function login({email, password}) {
    
    try {
        const response = await api.post("/api/auth/login", {
            email, password
        })
        if (response.data.token) {
            localStorage.setItem("token", response.data.token)
        }
        return response.data
    }catch(err){
        console.log(err)
        return err.response.data
    }
}

export async function logout() {
    
    try{
        const response = await api.get("/api/auth/logout")
        return response.data
    }catch(err){
        console.log(err)
        return err.response?.data
    }finally{
        localStorage.removeItem("token")
    }
}

export async function getMe() {
    try {
        const response = await api.get("/api/auth/get-me")
        return response.data
    }catch(err){
        if (err.response?.status !== 401) {
            console.log(err)
        }
        return err.response?.data
    }
}
